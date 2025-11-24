import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, appointmentsApi, productsApi, serviceDefinitionsApi, servicesApi } from '../lib/apiClient';
import type {
  Animal,
  Appointment,
  Attendance,
  AttendanceResponsible,
  CollaboratorSummary,
  Product,
} from '../types/api';
import { formatApiErrorMessage, type ApiErrorLike } from '../utils/apiErrors';
import { buildAttendancePdf } from '../utils/attendancePdf';

interface AttendanceProductItemFormValue {
  productId: string;
  quantidade: string;
  precoUnitario: string;
}

interface AttendanceCatalogItemFormValue {
  serviceDefinitionId: string;
  quantidade: string;
  precoUnitario: string;
  observacoes?: string;
}

interface AttendanceFormValues {
  animalId: string;
  data: string;
  fim?: string;
  responsavelId: string;
  assistantId?: string;
  catalogItems: AttendanceCatalogItemFormValue[];
  items: AttendanceProductItemFormValue[];
}

type AttendanceProductItemPayload = {
  productId: string;
  quantidade: number;
  precoUnitario: number;
};

type AttendanceCatalogItemPayload = {
  serviceDefinitionId: string;
  quantidade: number;
  precoUnitario: number;
  observacoes?: string;
};

type CreateAttendancePayload = {
  animalId: string;
  appointmentId?: string;
  data: string;
  preco?: number;
  responsavelId?: string;
  tipo: Attendance['tipo'];
  catalogItems: AttendanceCatalogItemPayload[];
  items: AttendanceProductItemPayload[];
  notes?: { conteudo: string }[];
};

type UpdateAttendancePayload = Partial<CreateAttendancePayload> & { notes?: { conteudo: string }[] };

const toDateTimeLocal = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const formatAppointmentLabel = (appointment: Appointment) => {
  const start = new Date(appointment.scheduledStart);
  const end = new Date(appointment.scheduledEnd);
  const date = start.toLocaleDateString('pt-BR');
  const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${startTime} - ${endTime} • ${appointment.animal.nome} (${appointment.owner.nome})`;
};

const NewServicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, hasModule } = useAuth();
  const canOverrideProductPrice = hasModule('products:write');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<
    CreateAttendancePayload | UpdateAttendancePayload | null
  >(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [pendingNotes, setPendingNotes] = useState<{ conteudo: string; createdAt: string }[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    searchParams.get('appointmentId') ?? '',
  );
  const formatErrorMessage = useCallback(
    (error: unknown, fallback: string) => formatApiErrorMessage(error, fallback),
    [],
  );

  const isExistingAttendance = Boolean(serviceId);
  const isViewing = searchParams.get('mode') === 'view';
  const isEditing = isExistingAttendance && !isViewing;
  const shouldDisableBaseFields = isExistingAttendance || isViewing;
  const isFormReadOnly = isViewing;

  const { register, handleSubmit, watch, reset, setValue, control, trigger, getValues } =
    useForm<AttendanceFormValues>({
      defaultValues: {
        animalId: '',
        data: '',
        fim: '',
        responsavelId: '',
      assistantId: '',
      catalogItems: [],
      items: [],
    },
  });

  const items = watch('items');
  const catalogItems = watch('catalogItems');
  const animalId = watch('animalId');
  const responsavelId = watch('responsavelId');
  const startDateTime = watch('data');
  const endDateTime = watch('fim');

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const {
    fields: catalogFields,
    append: appendCatalogItem,
    remove: removeCatalogItem,
  } = useFieldArray({
    control,
    name: 'catalogItems',
  });

  const { data: animals } = useQuery({
    queryKey: ['animals'],
    queryFn: () => apiClient.get<Animal[]>('/animals'),
  });

  const { data: serviceDefinitions } = useQuery({
    queryKey: ['service-definitions'],
    queryFn: serviceDefinitionsApi.list,
  });

  const { data: responsibles } = useQuery({
    queryKey: ['service-responsibles'],
    queryFn: () =>
      apiClient
        .get<{ responsibles: AttendanceResponsible[] }>('/services/responsibles')
        .then((response) => response.responsibles),
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['appointments', 'collaborators'],
    queryFn: () =>
      apiClient
        .get<{ collaborators: CollaboratorSummary[] }>('/appointments/collaborators')
        .then((response) => response.collaborators ?? []),
  });

  const { data: appointmentOptions = [] } = useQuery({
    queryKey: ['appointments', 'for-service'],
    queryFn: () => appointmentsApi.list(),
    select: (response) =>
      response.appointments.filter(
        (appointment) => appointment.status !== 'CONCLUIDO' && !appointment.serviceId,
      ),
  });

  const { data: appointmentDetails } = useQuery({
    queryKey: ['appointment', selectedAppointmentId],
    queryFn: () => appointmentsApi.getById(selectedAppointmentId).then((response) => response.appointment),
    enabled: Boolean(selectedAppointmentId),
  });

  const { data: attendance, isFetching: isLoadingAttendance } = useQuery({
    queryKey: ['attendance', serviceId],
    queryFn: () => servicesApi.getById(serviceId ?? ''),
    enabled: isExistingAttendance && Boolean(serviceId),
  });

  const selectedAnimal = useMemo(
    () => animals?.find((animal) => animal.id === animalId) ?? null,
    [animalId, animals],
  );

  const availableDefinitions = useMemo(
    () => serviceDefinitions ?? [],
    [serviceDefinitions],
  );

  const availableResponsibles = useMemo(
    () => responsibles ?? [],
    [responsibles],
  );

  const availableAssistants = useMemo(() => {
    return collaborators.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  }, [collaborators]);

  const availableAppointments = useMemo(() => {
    return appointmentOptions.slice().sort((a, b) =>
      a.scheduledStart.localeCompare(b.scheduledStart),
    );
  }, [appointmentOptions]);

  const selectedAppointment = useMemo<Appointment | null>(() => {
    if (appointmentDetails) return appointmentDetails;
    return appointmentOptions.find((appointment) => appointment.id === selectedAppointmentId) ?? null;
  }, [appointmentDetails, appointmentOptions, selectedAppointmentId]);

  const appointmentSelectOptions = useMemo(() => {
    const options = [...availableAppointments];

    if (selectedAppointment && !options.some((appointment) => appointment.id === selectedAppointment.id)) {
      options.unshift(selectedAppointment);
    }

    return options;
  }, [availableAppointments, selectedAppointment]);

  const linkedAppointmentFallbackLabel = useMemo(() => {
    if (!attendance?.appointmentId || selectedAppointment) return null;

    const summary = attendance.appointment;
    if (!summary) return null;

    const start = new Date(summary.scheduledStart);
    const end = new Date(summary.scheduledEnd);
    const date = start.toLocaleDateString('pt-BR');
    const startTime = start.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const endTime = end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return `${date} ${startTime} - ${endTime}`;
  }, [attendance?.appointment, attendance?.appointmentId, selectedAppointment]);

  useEffect(() => {
    if (!attendance) return;

    reset({
      animalId: attendance.animalId,
      data: toDateTimeLocal(attendance.data),
      fim: attendance.appointment?.scheduledEnd ? toDateTimeLocal(attendance.appointment.scheduledEnd) : '',
      responsavelId: attendance.responsavel?.id ?? '',
      assistantId: attendance.assistant?.id ?? '',
      catalogItems: attendance.catalogItems.map((item) => ({
        serviceDefinitionId: item.serviceDefinitionId,
        quantidade: String(item.quantidade),
        precoUnitario: item.valorUnitario.toFixed(2),
        observacoes: item.observacoes ?? undefined,
      })),
      items: attendance.items.map((item) => ({
        productId: item.productId,
        quantidade: String(item.quantidade),
        precoUnitario: item.valorUnitario.toFixed(2),
      })),
    });

    setSelectedAppointmentId(attendance.appointmentId ?? '');
    setPendingNotes([]);
    setNoteDraft('');
  }, [attendance, reset]);

  useEffect(() => {
    if (user?.id && !responsavelId) {
      setValue('responsavelId', user.id);
    }
  }, [responsavelId, setValue, user?.id]);

  const tutorHelperText = selectedAnimal
    ? selectedAnimal.owner?.nome
      ? 'Tutor definido automaticamente a partir do pet selecionado.'
      : 'Pet selecionado está sem tutor vinculado.'
    : 'Selecione um pet para visualizar o tutor responsável.';

  const petWithoutTutor = Boolean(selectedAnimal && !selectedAnimal.owner?.id);

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => apiClient.get<Product[]>('/products'),
  });

  const availableProducts = useMemo(
    () => (products ?? []).filter((product) => product.isActive),
    [products],
  );

  const handleCatalogDefinitionChange = useCallback(
    (index: number, definitionId: string) => {
      setValue(`catalogItems.${index}.serviceDefinitionId`, definitionId, {
        shouldDirty: true,
        shouldTouch: true,
      });

      const definition = availableDefinitions.find((candidate) => candidate.id === definitionId);
      const suggestedPrice = definition ? definition.precoSugerido.toFixed(2) : '';

      setValue(`catalogItems.${index}.precoUnitario`, suggestedPrice, {
        shouldDirty: true,
        shouldTouch: true,
      });

      const currentQuantity = getValues(`catalogItems.${index}.quantidade`);
      const parsedQuantity = Number(currentQuantity);
      if (!currentQuantity || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        setValue(`catalogItems.${index}.quantidade`, '1', {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      trigger('catalogItems');
    },
    [availableDefinitions, getValues, setValue, trigger],
  );

  const handleAddNote = () => {
    const content = noteDraft.trim();
    if (!content) {
      toast.error('Digite um texto para adicionar ao prontuário.');
      return;
    }

    setPendingNotes((prev) => [...prev, { conteudo: content, createdAt: new Date().toISOString() }]);
    setNoteDraft('');
  };

  const legacyNotes = useMemo(() => {
    if (!attendance?.observacoes) return [] as Attendance['notes'];

    return [
      {
        id: 'legacy-observacao',
        conteudo: attendance.observacoes,
        createdAt: attendance.createdAt ?? attendance.data,
        author:
          attendance.responsavel ??
          ({ id: 'responsavel-desconhecido', nome: 'Registro anterior', email: '' } as const),
      },
    ];
  }, [attendance?.createdAt, attendance?.data, attendance?.observacoes, attendance?.responsavel]);

  const existingNotes = useMemo(
    () => (attendance?.notes?.length ? attendance.notes : legacyNotes),
    [attendance?.notes, legacyNotes],
  );

  const noteHistory = useMemo(() => {
    const author = user
      ? { id: user.id, nome: user.nome, email: user.email }
      : { id: 'usuario-atual', nome: 'Usuário atual', email: '' };

    const pending = pendingNotes.map((note, index) => ({
      id: `pending-${index}`,
      conteudo: note.conteudo,
      createdAt: note.createdAt,
      author,
    }));

    return [...existingNotes, ...pending].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [existingNotes, pendingNotes, user]);

  const resolveProductBasePrice = useCallback(
    (product?: Product) => product?.precoBaseCatalogo ?? product?.precoVenda ?? 0,
    [],
  );

  const handleProductChange = useCallback(
    (index: number, productId: string) => {
      setValue(`items.${index}.productId`, productId, { shouldDirty: true, shouldTouch: true });

      const product = availableProducts.find((candidate) => candidate.id === productId);
      const basePrice = product ? resolveProductBasePrice(product).toFixed(2) : '';

      setValue(`items.${index}.precoUnitario`, basePrice, {
        shouldDirty: true,
        shouldTouch: true,
      });

      const currentQuantity = getValues(`items.${index}.quantidade`);
      const parsedQuantity = Number(currentQuantity);
      if (!currentQuantity || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
        setValue(`items.${index}.quantidade`, '1', {
          shouldDirty: true,
          shouldTouch: true,
        });
      }

      trigger('items');
    },
    [availableProducts, getValues, resolveProductBasePrice, setValue, trigger],
  );

  const duplicateProductIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of items ?? []) {
      if (!item?.productId) continue;
      if (seen.has(item.productId)) {
        duplicates.add(item.productId);
      } else {
        seen.add(item.productId);
      }
    }

    return duplicates;
  }, [items]);

  const duplicateCatalogDefinitionIds = useMemo(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const item of catalogItems ?? []) {
      const definitionId = item?.serviceDefinitionId;
      if (!definitionId) continue;
      if (seen.has(definitionId)) {
        duplicates.add(definitionId);
      } else {
        seen.add(definitionId);
      }
    }

    return duplicates;
  }, [catalogItems]);

  const catalogItemDetails = useMemo(() => {
    return (catalogItems ?? []).map((item) => {
      const definition = availableDefinitions.find(
        (candidate) => candidate.id === item?.serviceDefinitionId,
      );
      const quantityValue = Number(item?.quantidade);
      const quantity = Number.isInteger(quantityValue) && quantityValue > 0 ? quantityValue : 0;
      const unitPriceRaw = typeof item?.precoUnitario === 'string' ? item.precoUnitario : '';
      const unitPriceValue = Number(unitPriceRaw.replace(',', '.'));
      const unitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0
        ? unitPriceValue
        : definition?.precoSugerido ?? 0;
      const subtotal = quantity * unitPrice;

      return {
        definition,
        quantity,
        unitPrice,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        observacoes: item?.observacoes?.trim() ?? '',
      };
    });
  }, [availableDefinitions, catalogItems]);

  const itemDetails = useMemo(() => {
    return (items ?? []).map((item) => {
      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      const quantity = Number(item.quantidade);
      const normalizedQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
      const unitPriceRaw = typeof item.precoUnitario === 'string' ? item.precoUnitario : String(item.precoUnitario ?? '');
      const unitPriceValue = Number(unitPriceRaw.replace(',', '.'));
      const unitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0
        ? unitPriceValue
        : resolveProductBasePrice(product);
      const subtotal = normalizedQuantity * unitPrice;
      const remainingStock = product ? product.estoqueAtual - normalizedQuantity : undefined;
      const hasInsufficient = Boolean(product && normalizedQuantity > product.estoqueAtual);
      const isLowStock = Boolean(
        product && !hasInsufficient && remainingStock !== undefined && remainingStock <= product.estoqueMinimo,
      );

      return {
        product,
        quantity: normalizedQuantity,
        unitPrice,
        subtotal: Number.isFinite(subtotal) ? subtotal : 0,
        remainingStock,
        hasInsufficient,
        isLowStock,
      };
    });
  }, [availableProducts, items, resolveProductBasePrice]);

  const insufficientStock = itemDetails.some((detail) => detail.hasInsufficient);
  const hasDuplicateItems = duplicateProductIds.size > 0;
  const hasDuplicateCatalogItems = duplicateCatalogDefinitionIds.size > 0;
  const servicesTotal = catalogItemDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
  const productsTotal = itemDetails.reduce((sum, detail) => sum + detail.subtotal, 0);
  const overallTotal = servicesTotal + productsTotal;

  useEffect(() => {
    (items ?? []).forEach((item, index) => {
      if (!item?.productId) return;

      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      if (!product) return;

      const basePrice = resolveProductBasePrice(product);
      const formattedBasePrice = basePrice.toFixed(2);
      const rawUnitPrice = typeof item.precoUnitario === 'string' ? item.precoUnitario : String(item.precoUnitario ?? '');
      const normalizedUnitPrice = rawUnitPrice.replace(',', '.');
      const parsedUnitPrice = Number(normalizedUnitPrice);
      const hasCustomPrice = Number.isFinite(parsedUnitPrice)
        ? Number(parsedUnitPrice.toFixed(2)) !== Number(basePrice.toFixed(2))
        : false;

      if (!canOverrideProductPrice || rawUnitPrice.trim() === '' || !Number.isFinite(parsedUnitPrice)) {
        if (!rawUnitPrice || rawUnitPrice !== formattedBasePrice || hasCustomPrice) {
          setValue(`items.${index}.precoUnitario`, formattedBasePrice);
        }
      }
    });
  }, [availableProducts, canOverrideProductPrice, items, resolveProductBasePrice, setValue]);

  useEffect(() => {
    (catalogItems ?? []).forEach((item, index) => {
      if (!item?.serviceDefinitionId) return;
      if (item.precoUnitario) return;

      const definition = availableDefinitions.find(
        (candidate) => candidate.id === item.serviceDefinitionId,
      );
      if (definition) {
        setValue(`catalogItems.${index}.precoUnitario`, definition.precoSugerido.toFixed(2));
      }
    });
  }, [availableDefinitions, catalogItems, setValue]);

  useEffect(() => {
    if (!selectedAppointment) return;

    setValue('animalId', selectedAppointment.animalId);
    setValue('responsavelId', selectedAppointment.veterinarianId);
    setValue('assistantId', selectedAppointment.assistantId ?? '');
    setValue('data', toDateTimeLocal(selectedAppointment.scheduledStart));
    setValue('fim', toDateTimeLocal(selectedAppointment.scheduledEnd));
  }, [selectedAppointment, setValue]);

  const createAttendance = useMutation({
    mutationFn: (payload: CreateAttendancePayload) => apiClient.post<Attendance>('/services', payload),
    onSuccess: async (service, payload) => {
      toast.success('Atendimento registrado com sucesso.');

      setSubmitError(null);
      setLastPayload(null);

      if (payload?.items?.length) {
        try {
          await Promise.all(
            payload.items.map((item) =>
              productsApi.adjustStock(item.productId, { amount: -item.quantidade }),
            ),
          );
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
        } catch (err) {
          toast.error(
            err instanceof Error
              ? err.message
              : 'Não foi possível atualizar o estoque dos produtos utilizados.',
          );
        }
      }

      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      reset({
        animalId: '',
        data: '',
        fim: '',
        responsavelId: user?.id ?? '',
        assistantId: '',
        catalogItems: [],
        items: [],
      });
      setSelectedAppointmentId('');
      setPendingNotes([]);
      setNoteDraft('');
      navigate(`/animals`, { state: { highlight: service.animalId } });
    },
    onError: (err: unknown) => {
      const normalizedErrorMessage =
        err instanceof Error ? err.message.trim().toLowerCase() : undefined;

      if (normalizedErrorMessage?.includes('atendimento em andamento')) {
        const friendlyMessage =
          'Já existe um atendimento em andamento para este pet. Acesse ou conclua o atendimento aberto antes de criar outro.';
        setSubmitError(friendlyMessage);
        toast.error(friendlyMessage);
        return;
      }

      const message = formatErrorMessage(err, 'Não foi possível registrar o atendimento.');
      setSubmitError(message);
      toast.error(message);

      const serviceId =
        err instanceof Error && 'details' in err && err.details && typeof err.details === 'object'
          ? (err as ApiErrorLike & { details?: { serviceId?: string } }).details?.serviceId
          : undefined;

      if (serviceId) {
        navigate(`/services/${serviceId}/edit`);
      }
    },
  });

  const updateAttendance = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAttendancePayload }) =>
      servicesApi.update(id, payload),
    onSuccess: () => {
      toast.success('Atendimento atualizado com sucesso.');
      setSubmitError(null);
      setLastPayload(null);
      setPendingNotes([]);
      setNoteDraft('');
      queryClient.invalidateQueries({ queryKey: ['attendance', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
    },
    onError: (err: unknown) => {
      const message = formatErrorMessage(err, 'Não foi possível atualizar o atendimento.');
      setSubmitError(message);
      toast.error(message);
    },
  });

  const concludeAttendance = useMutation({
    mutationFn: (appointmentId: string) => {
      const normalizedNotes = selectedAppointment?.notes?.trim() ?? attendance?.observacoes?.trim();

      return appointmentsApi.complete(appointmentId, {
        notes: normalizedNotes && normalizedNotes.length > 0 ? normalizedNotes : undefined,
        service: attendance
          ? {
              tipo: attendance.tipo,
              preco: attendance.preco,
              observacoes: attendance.observacoes?.trim() || normalizedNotes || undefined,
            }
          : undefined,
      });
    },
    onSuccess: (_, appointmentId) => {
      toast.success('Agendamento concluído e sincronizado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['attendance', serviceId] });
      queryClient.invalidateQueries({ queryKey: ['appointment', appointmentId] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointments', 'billable'] });
    },
    onError: (err: unknown) => {
      const message = formatErrorMessage(err, 'Não foi possível encerrar o atendimento agora.');
      toast.error(message);
    },
  });

  const attendancePdf = useMutation({
    mutationFn: async () => {
      if (!serviceId) {
        throw new Error('Atendimento precisa ser salvo antes de gerar o PDF.');
      }

      const service = await servicesApi.getById(serviceId);
      await buildAttendancePdf(service);
    },
    onSuccess: () => {
      toast.success('PDF do atendimento gerado.');
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF do atendimento. Tente novamente.';
      toast.error(message);
    },
  });

  const hasInvalidSchedule = useMemo(() => {
    if (!startDateTime) return true;

    const start = new Date(startDateTime);
    if (Number.isNaN(start.getTime())) return true;

    if (!endDateTime) return false;

    const end = new Date(endDateTime);

    if (Number.isNaN(end.getTime())) return true;

    return end <= start;
  }, [endDateTime, startDateTime]);

  const disableSubmit =
    createAttendance.isPending ||
    updateAttendance.isPending ||
    isViewing ||
    (isExistingAttendance && isLoadingAttendance) ||
    insufficientStock ||
    hasDuplicateItems ||
    hasDuplicateCatalogItems ||
    petWithoutTutor ||
    hasInvalidSchedule;

  const onSubmit = handleSubmit(({ items: formItems, catalogItems: formCatalogItems, ...values }) => {
    if (isViewing) {
      return;
    }

    if (!values.animalId) {
      toast.error('Selecione um pet para registrar o atendimento.');
      return;
    }

    if (!selectedAnimal?.owner?.id) {
      toast.error('Pet selecionado precisa estar vinculado a um tutor.');
      return;
    }

    if (!values.responsavelId) {
      toast.error('Selecione um responsável pelo atendimento.');
      return;
    }

    const start = new Date(values.data);
    const end = values.fim ? new Date(values.fim) : null;

    if (Number.isNaN(start.getTime())) {
      toast.error('Informe a data e hora de início do atendimento.');
      return;
    }

    if (end && Number.isNaN(end.getTime())) {
      toast.error('Informe uma data de término válida ou deixe em branco para rascunhos.');
      return;
    }

    if (end && end <= start) {
      toast.error('A data de término precisa ser posterior ao início.');
      return;
    }

    const sanitizedCatalogItems: AttendanceCatalogItemPayload[] = [];
    let resolvedServiceType: Attendance['tipo'] | null = attendance?.tipo ?? null;

    for (const item of formCatalogItems ?? []) {
      if (!item.serviceDefinitionId) {
        toast.error('Selecione um serviço do catálogo para cada item adicionado.');
        return;
      }

      const definition = availableDefinitions.find((candidate) => candidate.id === item.serviceDefinitionId);
      if (!definition) {
        toast.error('Serviço selecionado não está disponível.');
        return;
      }

      const quantity = Number(item.quantidade);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        toast.error('Informe uma quantidade válida para cada serviço.');
        return;
      }

      const unitPriceValue = Number(String(item.precoUnitario ?? '').replace(',', '.'));
      const resolvedUnitPrice = Number.isFinite(unitPriceValue) && unitPriceValue >= 0
        ? Number(unitPriceValue.toFixed(2))
        : Number(definition.precoSugerido.toFixed(2));

      if (!resolvedServiceType) {
        resolvedServiceType = definition.tipo;
      }

      sanitizedCatalogItems.push({
        serviceDefinitionId: item.serviceDefinitionId,
        quantidade: quantity,
        precoUnitario: resolvedUnitPrice,
        observacoes: item.observacoes?.trim() ? item.observacoes.trim() : undefined,
      });
    }

    const catalogDefinitionIds = sanitizedCatalogItems.map((item) => item.serviceDefinitionId);
    if (new Set(catalogDefinitionIds).size !== catalogDefinitionIds.length) {
      toast.error('Há serviços do catálogo repetidos na lista. Ajuste antes de continuar.');
      return;
    }

    const sanitizedItems: AttendanceProductItemPayload[] = [];

    for (const item of formItems ?? []) {
      if (!item.productId) {
        toast.error('Selecione um produto para cada item adicionado.');
        return;
      }

      const product = availableProducts.find((candidate) => candidate.id === item.productId);
      if (!product) {
        toast.error('Produto selecionado não está disponível.');
        return;
      }

      const quantity = Number(item.quantidade);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        toast.error('Informe uma quantidade válida para cada produto.');
        return;
      }

      const basePrice = resolveProductBasePrice(product);
      const unitPriceValue = Number(String(item.precoUnitario ?? '').replace(',', '.'));
      const resolvedUnitPrice =
        Number.isFinite(unitPriceValue) && unitPriceValue >= 0
          ? unitPriceValue
          : basePrice;

      if (resolvedUnitPrice < 0 || Number.isNaN(resolvedUnitPrice)) {
        toast.error('Informe um preço unitário válido para os itens.');
        return;
      }

      if (quantity > product.estoqueAtual) {
        toast.error(`Estoque insuficiente para ${product.nome}. Disponível: ${product.estoqueAtual}.`);
        return;
      }

      sanitizedItems.push({
        productId: item.productId,
        quantidade: quantity,
        precoUnitario: Number(resolvedUnitPrice.toFixed(2)),
      });
    }

    const productIds = sanitizedItems.map((item) => item.productId);
    if (new Set(productIds).size !== productIds.length) {
      toast.error('Há produtos repetidos na lista de itens. Ajuste antes de continuar.');
      return;
    }

    const servicesTotalValue = sanitizedCatalogItems.reduce(
      (sum, item) => sum + item.precoUnitario * item.quantidade,
      0,
    );

    const productsTotalValue = sanitizedItems.reduce(
      (sum, item) => sum + item.precoUnitario * item.quantidade,
      0,
    );

    const overallTotalValue = servicesTotalValue + productsTotalValue;

    const notePayload = pendingNotes.map((note) => ({ conteudo: note.conteudo }));

    const resolvedAppointmentId = selectedAppointmentId || attendance?.appointmentId || undefined;

    const payload: CreateAttendancePayload = {
      animalId: values.animalId,
      appointmentId: resolvedAppointmentId,
      data: start.toISOString(),
      preco: Number(overallTotalValue.toFixed(2)),
      responsavelId: values.responsavelId,
      tipo: resolvedServiceType ?? 'CONSULTA',
      catalogItems: sanitizedCatalogItems,
      items: sanitizedItems,
      notes: notePayload.length ? notePayload : undefined,
    };

    setSubmitError(null);
    setLastPayload(payload);

    if (isExistingAttendance && serviceId) {
      updateAttendance.mutate({ id: serviceId, payload });
    } else {
      createAttendance.mutate(payload);
    }
  });

  const handleConcludeAttendance = () => {
    const appointmentId = attendance?.appointmentId ?? null;

    if (!appointmentId) {
      toast.error('Vincule um agendamento para encerrar o atendimento.');
      return;
    }

    concludeAttendance.mutate(appointmentId);
  };

  const pageTitle = isViewing
    ? 'Visualizar atendimento'
    : isExistingAttendance
      ? 'Editar atendimento'
      : 'Registrar Atendimento';
  const pageDescription = isViewing
    ? 'Campos bloqueados para visualização. Gere o PDF ou volte para editar o atendimento.'
    : isExistingAttendance
      ? 'Atualize serviços, insumos e entradas do prontuário mantendo o histórico organizado.'
      : 'Combine múltiplos serviços do catálogo e produtos utilizados para gerar um atendimento completo.';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">{pageTitle}</h1>
          <p className="text-sm text-brand-grafite/70">{pageDescription}</p>
        </div>
        <Button variant="secondary" asChild>
          <Link to="/services">Abrir catálogo de serviços</Link>
        </Button>
      </div>

      <Card
        title="Dados do atendimento"
        description="Preencha com atenção para manter o histórico impecável e inclua quantos serviços forem necessários no mesmo atendimento."
      >
        <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
          <div className="md:col-span-2">
            <SelectField
              label="Agendamento (opcional)"
              value={selectedAppointmentId}
              onChange={(event) => setSelectedAppointmentId(event.target.value)}
              disabled={Boolean(isExistingAttendance && attendance?.appointmentId) || isFormReadOnly}
            >
              <option value="">Registrar sem agendamento</option>
              {linkedAppointmentFallbackLabel ? (
                <option value={attendance?.appointmentId ?? ''}>
                  {linkedAppointmentFallbackLabel} (vínculo atual)
                </option>
              ) : null}
              {appointmentSelectOptions.map((appointment) => (
                <option key={appointment.id} value={appointment.id}>
                  {formatAppointmentLabel(appointment)}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
            <SelectField label="Pet" required disabled={shouldDisableBaseFields} {...register('animalId')}>
              <option value="">Selecione um pet</option>
              {animals?.map((animal) => (
                <option key={animal.id} value={animal.id}>
                  {animal.nome} — Tutor(a): {animal.owner?.nome ?? '—'}
                </option>
              ))}
            </SelectField>

            <Field
              label="Tutor"
              value={selectedAnimal ? selectedAnimal.owner?.nome ?? '—' : ''}
              placeholder="Selecione um pet"
              readOnly={shouldDisableBaseFields}
              disabled={isFormReadOnly}
              helperText={tutorHelperText}
              error={
                petWithoutTutor ? 'Vincule um tutor ao pet antes de registrar o atendimento.' : undefined
              }
            />
          </div>

          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
            <Field
              label="Início do atendimento"
              type="datetime-local"
              required
              {...register('data')}
              readOnly={shouldDisableBaseFields}
              disabled={isFormReadOnly}
            />

            <Field
              label="Término do atendimento"
              type="datetime-local"
              helperText="Opcional: preencha ao concluir para registrar a duração."
              {...register('fim')}
              readOnly={shouldDisableBaseFields}
              disabled={isFormReadOnly}
            />
          </div>

          <div className="grid gap-4 md:col-span-2 md:grid-cols-2">
            <SelectField
              label="Profissional responsável"
              required
              disabled={shouldDisableBaseFields}
              {...register('responsavelId')}
            >
              <option value="">Selecione um responsável</option>
              {availableResponsibles.map((responsible) => (
                <option key={responsible.id} value={responsible.id}>
                  {responsible.nome} — {responsible.email}
                </option>
              ))}
            </SelectField>

            <SelectField label="Profissional assistente" disabled={shouldDisableBaseFields} {...register('assistantId')}>
              <option value="">Sem assistente</option>
              {availableAssistants.map((assistant) => (
                <option key={assistant.id} value={assistant.id}>
                  {assistant.nome} — {assistant.email}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-brand-escuro">Serviços do catálogo</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  appendCatalogItem({
                    serviceDefinitionId: '',
                    quantidade: '1',
                    precoUnitario: '',
                    observacoes: '',
                  })
                }
                disabled={isFormReadOnly || !availableDefinitions.length}
              >
                Adicionar serviço
              </Button>
            </div>

            {!catalogFields.length ? (
              <p className="text-sm text-brand-grafite/70">
                Selecione um ou mais serviços do catálogo para registrar o que foi realizado no atendimento.
              </p>
            ) : null}

            <div className="space-y-4">
              {catalogFields.map((field, index) => {
                const detail =
                  catalogItemDetails[index] ?? {
                    definition: undefined,
                    quantity: 0,
                    unitPrice: 0,
                    subtotal: 0,
                    observacoes: '',
                  };
                const definition = detail.definition;
                const currentDefinitionId = catalogItems?.[index]?.serviceDefinitionId ?? '';
                const definitionRegister = register(`catalogItems.${index}.serviceDefinitionId` as const);

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Serviço"
                        required
                        helperText={definition?.descricao ?? 'Selecione um serviço do catálogo'}
                        disabled={isFormReadOnly}
                        {...definitionRegister}
                        onChange={(event) => {
                          definitionRegister.onChange(event);
                          handleCatalogDefinitionChange(index, event.target.value);
                        }}
                      >
                        <option value="">Selecione um serviço</option>
                        {availableDefinitions.map((serviceDefinition) => (
                          <option key={serviceDefinition.id} value={serviceDefinition.id}>
                            {serviceDefinition.nome}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        label="Quantidade"
                        type="number"
                        min="1"
                        step="1"
                        required
                        readOnly={isFormReadOnly}
                        disabled={isFormReadOnly}
                        {...register(`catalogItems.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço sugerido (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        readOnly={isFormReadOnly}
                        disabled={isFormReadOnly}
                        {...register(`catalogItems.${index}.precoUnitario` as const)}
                      />
                    </div>
                    <label className="block text-sm text-brand-escuro">
                      Observações
                      <textarea
                        {...register(`catalogItems.${index}.observacoes` as const)}
                        disabled={isFormReadOnly}
                        readOnly={isFormReadOnly}
                        className="mt-1 w-full rounded-xl border border-brand-azul/40 bg-white/90 px-4 py-2 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/40"
                        rows={2}
                        placeholder="Detalhes relevantes sobre este serviço"
                      />
                    </label>
                    {duplicateCatalogDefinitionIds.has(currentDefinitionId) ? (
                      <p className="text-sm text-red-500">Este serviço já foi selecionado em outro item.</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-grafite/80">
                      <span>Subtotal: R$ {detail.subtotal.toFixed(2)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isFormReadOnly}
                        onClick={() => removeCatalogItem(index)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {catalogItemDetails.length > 0 ? (
              <div className="rounded-2xl border border-brand-azul/30 bg-white/70 p-4">
                <h3 className="font-semibold text-brand-escuro">Resumo dos serviços</h3>
                <ul className="mt-2 space-y-2 text-sm text-brand-grafite/80">
                  {catalogItemDetails.map((detail, index) => {
                    const definition = detail.definition;
                    if (!definition) {
                      return (
                        <li key={`service-summary-placeholder-${catalogFields[index]?.id ?? index}`}>
                          Selecione um serviço para o item {index + 1}.
                        </li>
                      );
                    }

                    return (
                      <li key={`service-summary-${definition.id}-${index}`} className="flex flex-col gap-1">
                        <span>
                          {definition.nome}: {detail.quantity} un × R$ {detail.unitPrice.toFixed(2)} = R$ {detail.subtotal.toFixed(2)}
                        </span>
                        {detail.observacoes ? (
                          <span className="text-brand-grafite/60">Observações: {detail.observacoes}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm font-semibold text-brand-escuro">
                  Total de serviços: R$ {servicesTotal.toFixed(2)}
                </p>
              </div>
            ) : null}

            {hasDuplicateCatalogItems ? (
              <p className="text-sm text-red-500">Há serviços do catálogo repetidos. Remova duplicidades para continuar.</p>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-semibold text-brand-escuro">Produtos utilizados</span>
              <Button
                type="button"
                variant="secondary"
                onClick={() => append({ productId: '', quantidade: '1', precoUnitario: '' })}
                disabled={isFormReadOnly || !availableProducts.length}
              >
                Adicionar produto
              </Button>
            </div>

            {!fields.length ? (
              <p className="text-sm text-brand-grafite/70">
                Registre os insumos aplicados durante o atendimento para manter o estoque sempre atualizado.
              </p>
            ) : null}

            <div className="space-y-4">
              {fields.map((field, index) => {
                const detail =
                  itemDetails[index] ?? {
                    product: undefined,
                    quantity: 0,
                    unitPrice: 0,
                    subtotal: 0,
                    remainingStock: undefined,
                    hasInsufficient: false,
                    isLowStock: false,
                  };
                const product = detail.product;
                const stockHelper = product
                  ? `Disponível: ${product.estoqueAtual} • Mínimo: ${product.estoqueMinimo}`
                  : 'Selecione um produto';
                const currentProductId = items?.[index]?.productId ?? '';
                const productRegister = register(`items.${index}.productId` as const);

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Produto"
                        required
                        helperText={stockHelper}
                        disabled={isFormReadOnly}
                        {...productRegister}
                        onChange={(event) => {
                          productRegister.onChange(event);
                          handleProductChange(index, event.target.value);
                        }}
                      >
                        <option value="">Selecione um produto</option>
                        {availableProducts.map((productOption) => (
                          <option key={productOption.id} value={productOption.id}>
                            {productOption.nome}
                            {productOption.isSellable ? '' : ' (uso interno)'}
                          </option>
                        ))}
                      </SelectField>
                      <Field
                        label="Quantidade"
                        type="number"
                        min="1"
                        step="1"
                        required
                        readOnly={isFormReadOnly}
                        disabled={isFormReadOnly}
                        {...register(`items.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço unitário (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        readOnly={!canOverrideProductPrice}
                        disabled={isFormReadOnly}
                        helperText={
                          canOverrideProductPrice
                            ? undefined
                            : 'Preço definido automaticamente a partir do catálogo de produtos.'
                        }
                        {...register(`items.${index}.precoUnitario` as const)}
                      />
                    </div>
                    {product ? (
                      <p
                        className={
                          detail.hasInsufficient
                            ? 'text-sm text-red-500'
                            : detail.isLowStock
                              ? 'text-sm text-amber-600'
                              : 'text-sm text-brand-grafite/70'
                        }
                      >
                        {detail.hasInsufficient
                          ? `Estoque insuficiente. Restam apenas ${product.estoqueAtual} unidades.`
                          : `Estoque após uso: ${detail.remainingStock ?? product.estoqueAtual} unidades.`}
                      </p>
                    ) : null}
                    {duplicateProductIds.has(currentProductId) ? (
                      <p className="text-sm text-red-500">Este produto já foi selecionado em outro item.</p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-brand-grafite/80">
                      <span>Subtotal: R$ {detail.subtotal.toFixed(2)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isFormReadOnly}
                        onClick={() => remove(index)}
                      >
                        Remover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {itemDetails.length > 0 ? (
              <div className="rounded-2xl border border-brand-azul/30 bg-white/70 p-4">
                <h3 className="font-semibold text-brand-escuro">Resumo dos produtos</h3>
                <ul className="mt-2 space-y-2 text-sm text-brand-grafite/80">
                  {itemDetails.map((detail, index) => {
                    const product = detail.product;
                    if (!product) {
                      return (
                        <li key={`product-summary-placeholder-${fields[index]?.id ?? index}`}>
                          Selecione um produto para o item {index + 1}.
                        </li>
                      );
                    }

                    return (
                      <li key={`product-summary-${product.id}-${index}`} className="flex flex-col gap-1">
                        <span>
                          {product.nome}
                          {product.isSellable ? '' : ' (uso interno)'}: {detail.quantity} un × R${' '}
                          {detail.unitPrice.toFixed(2)} = R$ {detail.subtotal.toFixed(2)}
                        </span>
                        {detail.hasInsufficient ? (
                          <span className="text-red-500">Estoque insuficiente. Disponível: {product.estoqueAtual}.</span>
                        ) : detail.isLowStock ? (
                          <span className="text-amber-600">Atenção: estoque baixo após o uso ({detail.remainingStock} unidades).</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-3 text-sm font-semibold text-brand-escuro">
                  Total dos produtos: R$ {productsTotal.toFixed(2)}
                </p>
              </div>
            ) : null}

            {insufficientStock ? (
              <p className="text-sm text-red-500">Ajuste as quantidades: há produtos sem estoque suficiente.</p>
            ) : null}
            {hasDuplicateItems ? (
              <p className="text-sm text-red-500">Há produtos repetidos na lista. Remova duplicidades para continuar.</p>
            ) : null}
          </div>

          <div className="md:col-span-2 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-brand-escuro">Prontuário do atendimento</span>
              <span className="text-xs text-brand-grafite/70">Entradas ficam registradas com autor e horário.</span>
            </div>
            <div className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
              <label className="block text-sm text-brand-escuro">
                Nova entrada
                <textarea
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  readOnly={isFormReadOnly}
                  disabled={isFormReadOnly}
                  className="mt-1 w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-3 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
                  rows={3}
                  placeholder="Descreva evolução clínica, condutas e orientações."
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleAddNote}
                  disabled={
                    isFormReadOnly ||
                    noteDraft.trim().length === 0 ||
                    createAttendance.isPending ||
                    updateAttendance.isPending
                  }
                >
                  Registrar entrada
                </Button>
              </div>
            </div>
            {noteHistory.length ? (
              <ul className="space-y-3">
                {noteHistory.map((note) => (
                  <li key={note.id} className="rounded-2xl border border-brand-azul/30 bg-white/70 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-brand-grafite/70">
                      <span className="font-semibold text-brand-escuro">{note.author.nome}</span>
                      <span>{new Date(note.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-brand-grafite">{note.conteudo}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-grafite/70">
                Nenhum registro clínico ainda. Adicione a primeira entrada para montar o prontuário.
              </p>
            )}
          </div>

          <div className="md:col-span-2 rounded-2xl border border-brand-azul/30 bg-white/70 p-4 text-sm text-brand-grafite/80">
            <h3 className="font-semibold text-brand-escuro">Totais do atendimento</h3>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <span>Serviços: R$ {servicesTotal.toFixed(2)}</span>
              <span>Produtos: R$ {productsTotal.toFixed(2)}</span>
              <span className="font-semibold text-brand-escuro">Total geral: R$ {overallTotal.toFixed(2)}</span>
            </div>
          </div>

          {submitError ? (
            <div className="md:col-span-2 flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">{submitError}</span>
              {lastPayload ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span>Último payload enviado registrado para depuração.</span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={isViewing || createAttendance.isPending || updateAttendance.isPending}
                      onClick={() => {
                        if (isExistingAttendance && serviceId) {
                          updateAttendance.mutate({ id: serviceId, payload: lastPayload });
                        } else {
                          createAttendance.mutate(lastPayload as CreateAttendancePayload);
                        }
                      }}
                    >
                      {createAttendance.isPending || updateAttendance.isPending
                        ? 'Tentando novamente...'
                        : 'Tentar novamente'}
                    </Button>
                  </div>
                  <details className="rounded-xl border border-red-100 bg-white/80 p-3 text-brand-grafite">
                    <summary className="cursor-pointer text-xs font-semibold text-red-700">Ver payload enviado</summary>
                    <pre className="mt-2 max-h-64 overflow-auto text-xs leading-relaxed">
                      {JSON.stringify(lastPayload, null, 2)}
                    </pre>
                  </details>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="md:col-span-2 flex flex-wrap justify-end gap-3">
            {isExistingAttendance && attendance?.appointmentId ? (
              <Button
                type="button"
                variant="secondary"
                disabled={
                  isFormReadOnly ||
                  concludeAttendance.isPending ||
                  attendance?.appointment?.status === 'CONCLUIDO'
                }
                onClick={handleConcludeAttendance}
              >
                {attendance?.appointment?.status === 'CONCLUIDO'
                  ? 'Agendamento concluído'
                  : concludeAttendance.isPending
                    ? 'Concluindo agendamento...'
                    : 'Concluir agendamento'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={
                !serviceId ||
                attendancePdf.isPending ||
                createAttendance.isPending ||
                updateAttendance.isPending ||
                isLoadingAttendance
              }
              onClick={() => attendancePdf.mutate()}
            >
              {attendancePdf.isPending ? 'Gerando PDF...' : 'Gerar PDF do atendimento'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isFormReadOnly}
              onClick={() => {
                reset({
                  animalId: '',
                  data: '',
                  fim: '',
                  responsavelId: user?.id ?? '',
                  assistantId: '',
                  catalogItems: [],
                  items: [],
                });
                setPendingNotes([]);
                setNoteDraft('');
              }}
            >
              Limpar
            </Button>
            <Button type="submit" disabled={disableSubmit}>
              {createAttendance.isPending || updateAttendance.isPending
                ? 'Salvando atendimento...'
                : isViewing
                  ? 'Visualização'
                  : isEditing
                    ? 'Salvar atendimento'
                    : 'Registrar Atendimento'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default NewServicePage;
