import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { apiClient } from '../lib/apiClient';
import type {
  Appointment,
  AppointmentCalendarResponse,
  CollaboratorSummary,
} from '../types/api';
import { buildOwnerAddress, formatCpf } from '../utils/owner';

const statusLabels: Record<Appointment['status'], string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const viewLabels: Record<AppointmentCalendarResponse['view'], string> = {
  day: 'Dia',
  week: 'Semana',
  month: 'Mês',
};

const todayISO = new Date().toISOString().slice(0, 10);

interface CalendarFilters {
  view: AppointmentCalendarResponse['view'];
  date: string;
  collaboratorId: string;
  status: Appointment['status'] | '';
}

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const formatDayKey = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });

const getDayKey = (appointment: Appointment) => {
  const date = new Date(appointment.scheduledStart);
  const pad = (value: number) => value.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const CalendarPage = () => {
  const [filters, setFilters] = useState<CalendarFilters>({
    view: 'week',
    date: todayISO,
    collaboratorId: '',
    status: '',
  });

  const { data: collaborators } = useQuery({
    queryKey: ['appointments', 'collaborators'],
    queryFn: () =>
      apiClient.get<{ collaborators: CollaboratorSummary[] }>('/appointments/collaborators'),
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('view', filters.view);
    if (filters.date) params.set('date', filters.date);
    if (filters.collaboratorId) params.set('collaboratorId', filters.collaboratorId);
    if (filters.status) params.set('status', filters.status);
    return `?${params.toString()}`;
  }, [filters]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['appointments', 'calendar', queryString],
    queryFn: () => apiClient.get<AppointmentCalendarResponse>(`/appointments/calendar${queryString}`),
  });

  const appointmentsByDay = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    (data?.appointments ?? []).forEach((appointment) => {
      const key = getDayKey(appointment);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(appointment);
    });

    return Array.from(groups.entries()).sort(
      (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime(),
    );
  }, [data]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    refetch();
  };

  const handleToday = () => {
    setFilters((prev) => ({ ...prev, date: todayISO }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Agenda inteligente</h1>
          <p className="text-sm text-brand-grafite/70">
            Visualize a ocupação diária, semanal ou mensal da equipe clínica com indicadores de capacidade.
          </p>
        </div>
        <Button variant="ghost" onClick={handleToday}>
          Ir para hoje
        </Button>
      </div>

      <Card title="Ajuste o panorama" description="Combine visão temporal, profissional e status em segundos.">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
          <SelectField
            label="Visualização"
            value={filters.view}
            onChange={(event) => setFilters((prev) => ({ ...prev, view: event.target.value as CalendarFilters['view'] }))}
          >
            {Object.entries(viewLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <Field
            label="Data de referência"
            type="date"
            value={filters.date}
            onChange={(event) => setFilters((prev) => ({ ...prev, date: event.target.value }))}
          />

          <SelectField
            label="Colaborador"
            value={filters.collaboratorId}
            onChange={(event) => setFilters((prev) => ({ ...prev, collaboratorId: event.target.value }))}
          >
            <option value="">Todos</option>
            {collaborators?.collaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {collaborator.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, status: event.target.value as CalendarFilters['status'] }))
            }
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <div className="flex gap-3 md:col-span-4">
            <Button type="submit">Atualizar</Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFilters({ view: 'week', date: todayISO, collaboratorId: '', status: '' })}
            >
              Limpar filtros
            </Button>
          </div>
        </form>
      </Card>

      <Card
        title="Resumo de capacidade"
        description="Planeje recursos com base na demanda confirmada e nos espaços livres."
      >
        {isLoading ? <p>Carregando agenda...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar o calendário.</p> : null}
        {data ? (
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl bg-brand-azul/10 p-4">
              <p className="text-sm text-brand-grafite/70">Período</p>
              <p className="text-lg font-semibold text-brand-escuro">
                {new Date(data.range.start).toLocaleDateString('pt-BR')} —{' '}
                {new Date(data.range.end).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-xs text-brand-grafite/60">Visão {viewLabels[data.view]}</p>
            </div>
            <div className="rounded-2xl bg-brand-azul/10 p-4">
              <p className="text-sm text-brand-grafite/70">Total agendado</p>
              <p className="text-2xl font-bold text-brand-escuro">{data.summary.total}</p>
              <p className="text-xs text-brand-grafite/60">{data.summary.confirmed} confirmados</p>
            </div>
            <div className="rounded-2xl bg-brand-azul/10 p-4">
              <p className="text-sm text-brand-grafite/70">Concluídos</p>
              <p className="text-2xl font-bold text-brand-escuro">{data.summary.concluded}</p>
              <p className="text-xs text-brand-grafite/60">Pendentes: {data.summary.pending}</p>
            </div>
            <div className="rounded-2xl bg-brand-azul/10 p-4">
              <p className="text-sm text-brand-grafite/70">Capacidade</p>
              {data.summary.capacity.totalSlots !== null ? (
                <>
                  <p className="text-2xl font-bold text-brand-escuro">
                    {data.summary.capacity.availableSlots} vagas livres
                  </p>
                  <p className="text-xs text-brand-grafite/60">
                    {data.summary.capacity.bookedSlots} ocupadas de {data.summary.capacity.totalSlots}
                  </p>
                </>
              ) : (
                <p className="text-sm text-brand-grafite/70">
                  Filtre por colaborador para estimar as janelas disponíveis.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </Card>

      <Card
        title="Mapa da semana"
        description="Mergulhe nas consultas por dia e identifique conflitos rapidamente."
      >
        {!isLoading && !appointmentsByDay.length ? (
          <p className="text-sm text-brand-grafite/70">
            Nenhum compromisso encontrado para os filtros escolhidos.
          </p>
        ) : null}

        <div className="space-y-4">
          {appointmentsByDay.map(([dayKey, dayAppointments]) => (
            <div key={dayKey} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4">
              <h3 className="font-montserrat text-lg font-semibold capitalize text-brand-escuro">
                {formatDayKey(dayKey)}
              </h3>
              <ul className="mt-3 space-y-3">
                {dayAppointments.map((appointment) => {
                  const ownerCpf = formatCpf(appointment.owner.cpf);
                  const ownerAddress = buildOwnerAddress(appointment.owner);

                  return (
                    <li key={appointment.id} className="rounded-xl bg-brand-azul/5 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-brand-escuro">
                          {formatDateTime(appointment.scheduledStart)} —{' '}
                          {formatDateTime(appointment.scheduledEnd)}
                        </p>
                        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-escuro shadow">
                          {statusLabels[appointment.status]}
                        </span>
                      </div>
                      <p className="text-sm text-brand-grafite/80">
                        {appointment.animal.nome} • Tutor(a): {appointment.owner.nome}
                      </p>
                      {appointment.owner.telefone ? (
                        <p className="text-xs text-brand-grafite/70">{appointment.owner.telefone}</p>
                      ) : null}
                      {ownerCpf ? <p className="text-xs text-brand-grafite/70">CPF: {ownerCpf}</p> : null}
                      {ownerAddress ? <p className="text-xs text-brand-grafite/70">{ownerAddress}</p> : null}
                      <p className="text-xs text-brand-grafite/70">
                        Vet: {appointment.veterinarian.nome}{' '}
                        {appointment.availability.veterinarianConflict ? '• conflito de agenda' : ''}
                        {appointment.assistant
                          ? ` • Assist.: ${appointment.assistant.nome}${
                              appointment.availability.assistantConflict ? ' (conflito)' : ''
                            }`
                          : ''}
                      </p>
                      {appointment.notes ? (
                        <p className="mt-1 text-xs text-brand-grafite/70">Notas: {appointment.notes}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default CalendarPage;
