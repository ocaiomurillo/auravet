import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import Modal from '../components/Modal';
import { apiClient, appointmentsApi, servicesApi } from '../lib/apiClient';
import type {
  Animal,
  Appointment,
  AttendanceType,
  CollaboratorSummary,
  OwnerSummary,
} from '../types/api';
import { buildOwnerAddress, formatCpf } from '../utils/owner';
import { buildAttendancePdf } from '../utils/attendancePdf';

const statusLabels: Record<Appointment['status'], string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const attendanceTypeLabels: Partial<Record<AttendanceType | string, string>> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const getAttendanceTypeLabel = (tipo?: string | null) => {
  if (!tipo) return 'Tipo não informado';
  if (attendanceTypeLabels[tipo]) return attendanceTypeLabels[tipo] as string;

  const humanizedType = tipo
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\p{L}/u, (letter) => letter.toUpperCase());

  return humanizedType || 'Tipo não informado';
};

interface AppointmentFormState {
  ownerId: string;
  animalId: string;
  veterinarianId: string;
  assistantId: string;
  tipo: AttendanceType | '';
  status: Appointment['status'];
  scheduledStart: string;
  scheduledEnd: string;
  notes: string;
}

interface AppointmentFilters {
  status: Appointment['status'] | '';
  collaboratorId: string;
  ownerId: string;
  animalId: string;
  from: string;
  to: string;
}

interface RescheduleFormState {
  id: string | null;
  start: string;
  end: string;
  notes: string;
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const toDateTimeLocal = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

const AppointmentsPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AppointmentFilters>({
    status: '',
    collaboratorId: '',
    ownerId: '',
    animalId: '',
    from: '',
    to: '',
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<AppointmentFormState>({
    ownerId: '',
    animalId: '',
    veterinarianId: '',
    assistantId: '',
    tipo: '',
    status: 'AGENDADO',
    scheduledStart: '',
    scheduledEnd: '',
    notes: '',
  });
  const [rescheduleForm, setRescheduleForm] = useState<RescheduleFormState>({
    id: null,
    start: '',
    end: '',
    notes: '',
  });

  const { data: collaborators = [] } = useQuery({
    queryKey: ['appointments', 'collaborators'],
    queryFn: () =>
      apiClient
        .get<{ collaborators: CollaboratorSummary[] }>('/appointments/collaborators')
        .then((response) => response.collaborators ?? []),
  });

  const { data: owners } = useQuery({
    queryKey: ['owners', 'basic'],
    queryFn: () => apiClient.get<OwnerSummary[]>('/owners/basic'),
  });

  const animalsQueryKey = useMemo(() => ['animals', filters.ownerId] as const, [filters.ownerId]);
  const { data: animals } = useQuery({
    queryKey: animalsQueryKey,
    queryFn: () =>
      filters.ownerId
        ? apiClient.get<Animal[]>(`/animals?ownerId=${filters.ownerId}`)
        : apiClient.get<Animal[]>('/animals'),
  });

  const createAnimalsQueryKey = useMemo(
    () => ['animals', 'appointment-form', createForm.ownerId || 'all'] as const,
    [createForm.ownerId],
  );
  const { data: createAnimals } = useQuery({
    queryKey: createAnimalsQueryKey,
    queryFn: () =>
      createForm.ownerId
        ? apiClient.get<Animal[]>(`/animals?ownerId=${createForm.ownerId}`)
        : apiClient.get<Animal[]>('/animals'),
    enabled: isCreateOpen,
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.collaboratorId) params.set('veterinarianId', filters.collaboratorId);
    if (filters.ownerId) params.set('ownerId', filters.ownerId);
    if (filters.animalId) params.set('animalId', filters.animalId);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    return params.toString() ? `?${params.toString()}` : '';
  }, [filters]);

  const {
    data: appointmentsResponse,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['appointments', queryString],
    queryFn: () => apiClient.get<{ appointments: Appointment[] }>(`/appointments${queryString}`),
  });

  const appointments = appointmentsResponse?.appointments ?? [];
  const [pdfServiceId, setPdfServiceId] = useState<string | null>(null);

  const confirmMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<{ appointment: Appointment }>(`/appointments/${id}/confirm`, {}),
    onSuccess: () => {
      toast.success('Consulta confirmada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => {
      toast.error('Não foi possível confirmar o agendamento.');
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, start, end, notes }: { id: string; start: string; end: string; notes: string }) =>
      apiClient.patch<{ appointment: Appointment }>(`/appointments/${id}/reschedule`, {
        scheduledStart: new Date(start).toISOString(),
        scheduledEnd: new Date(end).toISOString(),
        notes: notes.trim() ? notes : undefined,
      }),
    onSuccess: () => {
      toast.success('Horário reagendado com sucesso.');
      setRescheduleForm({ id: null, start: '', end: '', notes: '' });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => {
      toast.error('Não foi possível reagendar este atendimento.');
    },
  });

  const attendancePdf = useMutation({
    mutationFn: async ({ serviceId, appointment }: { serviceId: string; appointment: Appointment }) => {
      const service = await servicesApi.getById(serviceId);
      await buildAttendancePdf(service, appointment);
    },
    onMutate: ({ serviceId }) => setPdfServiceId(serviceId),
    onSuccess: () => {
      toast.success('PDF do atendimento gerado.');
    },
    onError: (err: unknown) => {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF do atendimento. Tente novamente.',
      );
    },
    onSettled: () => setPdfServiceId(null),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.patch<{ appointment: Appointment }>(`/appointments/${id}/complete`, {}),
    onSuccess: () => {
      toast.success('Atendimento finalizado e registrado no histórico.');
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
    },
    onError: () => {
      toast.error('Não foi possível finalizar o agendamento.');
    },
  });

  const createMutation = useMutation({
    mutationFn: (payload: {
      ownerId: string;
      animalId: string;
      veterinarianId: string;
      assistantId?: string;
      tipo: AttendanceType;
      scheduledStart: string;
      scheduledEnd: string;
      status: Appointment['status'];
      notes?: string;
    }) =>
      appointmentsApi.create({
        ownerId: payload.ownerId,
        animalId: payload.animalId,
        veterinarianId: payload.veterinarianId,
        assistantId: payload.assistantId,
        tipo: payload.tipo,
        scheduledStart: payload.scheduledStart,
        scheduledEnd: payload.scheduledEnd,
        status: payload.status,
        notes: payload.notes,
      }),
    onSuccess: (response) => {
      const { appointment } = response;
      toast.success(
        `Agendamento de ${getAttendanceTypeLabel(appointment.tipo)} criado com sucesso.`,
      );
      if (appointment.availability.veterinarianConflict || appointment.availability.assistantConflict) {
        toast.warning(
          'Atenção: existem conflitos de agenda para este horário. Reveja a disponibilidade dos colaboradores.',
        );
      }
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsCreateOpen(false);
      setCreateForm({
        ownerId: '',
        animalId: '',
        veterinarianId: '',
        assistantId: '',
        tipo: '',
        status: 'AGENDADO',
        scheduledStart: '',
        scheduledEnd: '',
        notes: '',
      });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar o agendamento.');
    },
  });

  const handleSubmitFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    refetch();
  };

  const handleResetFilters = () => {
    setFilters({ status: '', collaboratorId: '', ownerId: '', animalId: '', from: '', to: '' });
  };

  const openRescheduleForm = (appointment: Appointment) => {
    setRescheduleForm({
      id: appointment.id,
      start: toDateTimeLocal(appointment.scheduledStart),
      end: toDateTimeLocal(appointment.scheduledEnd),
      notes: appointment.notes ?? '',
    });
  };

  const resetCreateForm = () => {
    setCreateForm({
      ownerId: '',
      animalId: '',
      veterinarianId: '',
      assistantId: '',
      tipo: '',
      status: 'AGENDADO',
      scheduledStart: '',
      scheduledEnd: '',
      notes: '',
    });
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();
  };

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!createForm.ownerId) {
      toast.error('Selecione um tutor para o agendamento.');
      return;
    }

    if (!createForm.animalId) {
      toast.error('Selecione um pet para o agendamento.');
      return;
    }

    if (!createForm.veterinarianId) {
      toast.error('Selecione o profissional responsável.');
      return;
    }

    if (!createForm.tipo) {
      toast.error('Selecione o tipo de atendimento.');
      return;
    }

    if (!createForm.scheduledStart || !createForm.scheduledEnd) {
      toast.error('Informe o horário inicial e final do agendamento.');
      return;
    }

    const startDate = new Date(createForm.scheduledStart);
    const endDate = new Date(createForm.scheduledEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      toast.error('Informe um horário válido.');
      return;
    }

    if (endDate <= startDate) {
      toast.error('O horário final precisa ser posterior ao horário inicial.');
      return;
    }

    const attendanceType = createForm.tipo as AttendanceType;

    createMutation.mutate({
      ownerId: createForm.ownerId,
      animalId: createForm.animalId,
      veterinarianId: createForm.veterinarianId,
      assistantId: createForm.assistantId || undefined,
      tipo: attendanceType,
      scheduledStart: startDate.toISOString(),
      scheduledEnd: endDate.toISOString(),
      status: createForm.status,
      notes: createForm.notes.trim() ? createForm.notes : undefined,
    });
  };

  const handleRescheduleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rescheduleForm.id) return;
    rescheduleMutation.mutate({
      id: rescheduleForm.id,
      start: rescheduleForm.start,
      end: rescheduleForm.end,
      notes: rescheduleForm.notes,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Agendamentos</h1>
          <p className="text-sm text-brand-grafite/70">
            Organize consultas, confirme presenças e visualize conflitos de agenda dos colaboradores.
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
        >
          Novo agendamento
        </Button>
      </div>

      <Card title="Filtrar agenda" description="Personalize a visão por status, tutor, pet ou responsável clínico.">
        <form className="grid gap-4 md:grid-cols-6" onSubmit={handleSubmitFilters}>
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as AppointmentFilters['status'] }))
            }
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Colaborador"
            value={filters.collaboratorId}
            onChange={(event) => setFilters((prev) => ({ ...prev, collaboratorId: event.target.value }))}
          >
            <option value="">Todos os profissionais</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Tutor"
            value={filters.ownerId}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, ownerId: event.target.value, animalId: '' }))
            }
          >
            <option value="">Todos os tutores</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Pet"
            value={filters.animalId}
            onChange={(event) => setFilters((prev) => ({ ...prev, animalId: event.target.value }))}
          >
            <option value="">Todos os pets</option>
            {animals?.map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nome}
              </option>
            ))}
          </SelectField>

          <Field
            label="De"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />

          <Field
            label="Até"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />

          <div className="flex gap-3 md:col-span-6">
            <Button type="submit">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={handleResetFilters}>
              Limpar
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Agenda clínica"
        description="Confirme, reagende ou finalize consultas com indicadores de disponibilidade."
      >
        {isLoading ? <p>Carregando agendamentos...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar os agendamentos.</p> : null}
        {!isLoading && !appointments.length ? (
          <p className="text-sm text-brand-grafite/70">
            Ainda não existem consultas neste filtro. Experimente ajustar os critérios ou agendar uma nova avaliação.
          </p>
        ) : null}

        <ul className="space-y-4">
          {appointments.map((appointment) => {
            const isRescheduling = rescheduleForm.id === appointment.id;
            const canConfirm = appointment.status === 'AGENDADO';
            const canComplete = appointment.status !== 'CONCLUIDO' && appointment.status !== 'CANCELADO';
            const isGeneratingPdf =
              appointment.service?.id && pdfServiceId === appointment.service.id && attendancePdf.isPending;

            const veterinarianConflict = appointment.availability.veterinarianConflict;
            const assistantConflict = appointment.availability.assistantConflict;
            const ownerCpf = formatCpf(appointment.owner.cpf);
            const ownerAddress = buildOwnerAddress(appointment.owner);

            return (
              <li key={appointment.id} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">
                      {appointment.animal.nome} • {statusLabels[appointment.status]}
                    </p>
                    <p className="text-sm text-brand-grafite/70">
                      {formatDateTime(appointment.scheduledStart)} — {formatDateTime(appointment.scheduledEnd)} • Duração:{' '}
                      {appointment.durationMinutes} min
                    </p>
                    <p className="text-sm text-brand-grafite/70">
                      Tipo de atendimento: {getAttendanceTypeLabel(appointment.tipo)}
                    </p>
                    <p className="text-sm text-brand-grafite/70">
                      Tutor(a): {appointment.owner.nome} • Veterinário(a): {appointment.veterinarian.nome}
                    </p>
                    {appointment.owner.telefone ? (
                      <p className="text-xs text-brand-grafite/60">{appointment.owner.telefone}</p>
                    ) : null}
                    {ownerCpf ? <p className="text-xs text-brand-grafite/60">CPF: {ownerCpf}</p> : null}
                    {ownerAddress ? <p className="text-xs text-brand-grafite/60">{ownerAddress}</p> : null}
                    {appointment.assistant ? (
                      <p className="text-sm text-brand-grafite/70">Assistente: {appointment.assistant.nome}</p>
                    ) : (
                      <p className="text-sm text-brand-grafite/50">Sem assistente designado</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${
                          veterinarianConflict
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        Veterinário {veterinarianConflict ? 'com conflito' : 'disponível'}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 font-medium ${
                          assistantConflict
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-brand-grafite/80'
                        }`}
                      >
                        Assistência {assistantConflict ? 'com conflito' : 'liberada'}
                      </span>
                    </div>
                    {appointment.notes ? (
                      <p className="mt-2 text-sm text-brand-grafite/80">Observações: {appointment.notes}</p>
                    ) : null}
                    {appointment.service ? (
                      <p className="mt-2 text-sm text-brand-grafite/80">
                        Atendimento registrado em {new Date(appointment.service.data).toLocaleDateString('pt-BR')} •{' '}
                        R$ {appointment.service.preco.toFixed(2)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="secondary"
                      disabled={!canConfirm || confirmMutation.isPending}
                      onClick={() => confirmMutation.mutate(appointment.id)}
                    >
                      Confirmar presença
                    </Button>
                    <Button
                      variant="ghost"
                      disabled={rescheduleMutation.isPending}
                      onClick={() => openRescheduleForm(appointment)}
                    >
                      Reagendar
                    </Button>
                    {appointment.service?.id ? (
                      <Button
                        variant="ghost"
                        disabled={attendancePdf.isPending}
                        onClick={() =>
                          attendancePdf.mutate({ serviceId: appointment.service?.id ?? '', appointment })
                        }
                      >
                        {isGeneratingPdf ? 'Gerando PDF...' : 'Gerar PDF do atendimento'}
                      </Button>
                    ) : null}
                    <Button
                      variant="primary"
                      disabled={!canComplete || completeMutation.isPending}
                      onClick={() => completeMutation.mutate(appointment.id)}
                    >
                      Finalizar atendimento
                    </Button>
                  </div>
                </div>

                {isRescheduling ? (
                  <form className="mt-4 grid gap-4 rounded-xl bg-brand-azul/5 p-4 md:grid-cols-4" onSubmit={handleRescheduleSubmit}>
                    <Field
                      label="Início"
                      type="datetime-local"
                      value={rescheduleForm.start}
                      onChange={(event) => setRescheduleForm((prev) => ({ ...prev, start: event.target.value }))}
                      required
                    />
                    <Field
                      label="Fim"
                      type="datetime-local"
                      value={rescheduleForm.end}
                      onChange={(event) => setRescheduleForm((prev) => ({ ...prev, end: event.target.value }))}
                      required
                    />
                    <Field
                      label="Notas"
                      value={rescheduleForm.notes}
                      onChange={(event) => setRescheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Motivo do ajuste ou orientações internas"
                      className="md:col-span-2"
                    />
                    <div className="flex gap-3 md:col-span-4">
                      <Button type="submit" disabled={rescheduleMutation.isPending}>
                        Salvar novo horário
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setRescheduleForm({ id: null, start: '', end: '', notes: '' })}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      <Modal
        open={isCreateOpen}
        onClose={closeCreateModal}
        title="Novo agendamento"
        description="Selecione tutor, pet e equipe para registrar um novo atendimento."
        actions={
          <>
            <Button type="button" variant="ghost" onClick={closeCreateModal} disabled={createMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" form="create-appointment-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Criar agendamento'}
            </Button>
          </>
        }
      >
        <form id="create-appointment-form" className="grid gap-4" onSubmit={handleCreateSubmit}>
          <SelectField
            label="Tutor"
            value={createForm.ownerId}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                ownerId: event.target.value,
                animalId: '',
              }))
            }
            required
          >
            <option value="">Selecione um tutor</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Pet"
            value={createForm.animalId}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                animalId: event.target.value,
              }))
            }
            required
          >
            <option value="">Selecione um pet</option>
            {(createAnimals ?? []).map((animal) => (
              <option key={animal.id} value={animal.id}>
                {animal.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Profissional responsável"
            value={createForm.veterinarianId}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                veterinarianId: event.target.value,
              }))
            }
            required
          >
            <option value="">Selecione um colaborador</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Profissional assistente"
            value={createForm.assistantId}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                assistantId: event.target.value,
              }))
            }
          >
            <option value="">Sem assistente</option>
            {collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Tipo de atendimento"
            value={createForm.tipo}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                tipo: event.target.value as AttendanceType | '',
              }))
            }
            required
          >
            <option value="" disabled>
              Selecione o tipo de atendimento
            </option>
            {Object.entries(attendanceTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Início"
              type="datetime-local"
              value={createForm.scheduledStart}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  scheduledStart: event.target.value,
                }))
              }
              required
            />
            <Field
              label="Fim"
              type="datetime-local"
              value={createForm.scheduledEnd}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  scheduledEnd: event.target.value,
                }))
              }
              required
            />
          </div>

          <SelectField
            label="Status"
            value={createForm.status}
            onChange={(event) =>
              setCreateForm((prev) => ({
                ...prev,
                status: event.target.value as Appointment['status'],
              }))
            }
          >
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <label className="flex flex-col gap-1 text-sm font-medium text-brand-grafite">
            <span className="font-semibold text-brand-escuro">Observações (opcional)</span>
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-brand-azul/60 bg-white/90 px-4 py-2 text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/50"
              value={createForm.notes}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  notes: event.target.value,
                }))
              }
              placeholder="Anotações internas, orientações ao tutor ou observações clínicas"
              maxLength={2000}
            />
          </label>
        </form>
      </Modal>
    </div>
  );
};

export default AppointmentsPage;
