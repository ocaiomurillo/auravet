import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, productsApi, serviceDefinitionsApi, servicesApi } from '../lib/apiClient';
import type {
  Animal,
  Attendance,
  AttendanceResponsible,
  CollaboratorSummary,
  Product,
} from '../types/api';

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

const NewServicePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: serviceId } = useParams();
  const { user, hasModule } = useAuth();
  const canOverrideProductPrice = hasModule('products:write');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastPayload, setLastPayload] = useState<
    CreateAttendancePayload | UpdateAttendancePayload | null
  >(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [pendingNotes, setPendingNotes] = useState<{ conteudo: string; createdAt: string }[]>([]);

  const isEditing = Boolean(serviceId);

  const { register, handleSubmit, watch, reset, setValue, control } = useForm<AttendanceFormValues>({
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

  const { data: attendance, isFetching: isLoadingAttendance } = useQuery({
    queryKey: ['attendance', serviceId],
    queryFn: () => servicesApi.getById(serviceId ?? ''),
    enabled: isEditing && Boolean(serviceId),
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
      setPendingNotes([]);
      setNoteDraft('');
      navigate(`/animals`, { state: { highlight: service.animalId } });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Não foi possível registrar o atendimento.';
      setSubmitError(message);
      toast.error(message);
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
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Não foi possível atualizar o atendimento.';
      setSubmitError(message);
      toast.error(message);
    },
  });

  const hasInvalidSchedule = useMemo(() => {
    if (!startDateTime || !endDateTime) return true;

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;

    return end <= start;
  }, [endDateTime, startDateTime]);

  const disableSubmit =
    createAttendance.isPending ||
    updateAttendance.isPending ||
    (isEditing && isLoadingAttendance) ||
    insufficientStock ||
    hasDuplicateItems ||
    hasDuplicateCatalogItems ||
    petWithoutTutor ||
    hasInvalidSchedule;

  const onSubmit = handleSubmit(({ items: formItems, catalogItems: formCatalogItems, ...values }) => {
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

    if (!end || Number.isNaN(end.getTime())) {
      toast.error('Informe a data e hora de término do atendimento.');
      return;
    }

    if (end <= start) {
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

    const notePayload = pendingNotes.map((note) => ({ conteudo: note.conteudo }));

    const payload: CreateAttendancePayload = {
      animalId: values.animalId,
      data: start.toISOString(),
      preco: Number(servicesTotalValue.toFixed(2)),
      responsavelId: values.responsavelId,
      tipo: resolvedServiceType ?? 'CONSULTA',
      catalogItems: sanitizedCatalogItems,
      items: sanitizedItems,
      notes: notePayload,
    };

    setSubmitError(null);
    setLastPayload(payload);

    if (isEditing && serviceId) {
      updateAttendance.mutate({ id: serviceId, payload });
    } else {
      createAttendance.mutate(payload);
    }
  });

  const pageTitle = isEditing ? 'Editar atendimento' : 'Registrar Atendimento';
  const pageDescription = isEditing
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
          <SelectField label="Pet" required {...register('animalId')}>
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
            readOnly
            helperText={tutorHelperText}
            error={petWithoutTutor ? 'Vincule um tutor ao pet antes de registrar o atendimento.' : undefined}
          />

          <Field
            label="Início do atendimento"
            type="datetime-local"
            required
            {...register('data')}
          />

          <Field label="Término do atendimento" type="datetime-local" required {...register('fim')} />

          <SelectField
            label="Responsável pelo atendimento"
            required
            {...register('responsavelId')}
          >
            <option value="">Selecione um responsável</option>
            {availableResponsibles.map((responsible) => (
              <option key={responsible.id} value={responsible.id}>
                {responsible.nome} — {responsible.email}
              </option>
            ))}
          </SelectField>

          <SelectField label="Assistente (opcional)" {...register('assistantId')}>
            <option value="">Sem assistente</option>
            {availableAssistants.map((assistant) => (
              <option key={assistant.id} value={assistant.id}>
                {assistant.nome} — {assistant.email}
              </option>
            ))}
          </SelectField>

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
                disabled={!availableDefinitions.length}
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

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Serviço"
                        required
                        helperText={definition?.descricao ?? 'Selecione um serviço do catálogo'}
                        {...register(`catalogItems.${index}.serviceDefinitionId` as const)}
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
                        {...register(`catalogItems.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço sugerido (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        {...register(`catalogItems.${index}.precoUnitario` as const)}
                      />
                    </div>
                    <label className="block text-sm text-brand-escuro">
                      Observações
                      <textarea
                        {...register(`catalogItems.${index}.observacoes` as const)}
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
                      <Button type="button" variant="ghost" onClick={() => removeCatalogItem(index)}>
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
                disabled={!availableProducts.length}
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

                return (
                  <div key={field.id} className="space-y-3 rounded-2xl border border-brand-azul/40 bg-white/80 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <SelectField
                        label="Produto"
                        required
                        helperText={stockHelper}
                        {...register(`items.${index}.productId` as const)}
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
                        {...register(`items.${index}.quantidade` as const)}
                      />
                      <Field
                        label="Preço unitário (R$)"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        readOnly={!canOverrideProductPrice}
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
                      <Button type="button" variant="ghost" onClick={() => remove(index)}>
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
                  className="mt-1 w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-3 text-sm text-brand-grafite focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
                  rows={3}
                  placeholder="Descreva evolução clínica, condutas e orientações."
                />
              </label>
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleAddNote}
                  disabled={noteDraft.trim().length === 0 || createAttendance.isPending || updateAttendance.isPending}
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
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="font-semibold">{submitError}</span>
              {lastPayload ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={createAttendance.isPending || updateAttendance.isPending}
                  onClick={() => {
                    if (isEditing && serviceId) {
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
              ) : null}
            </div>
          ) : null}

          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
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
