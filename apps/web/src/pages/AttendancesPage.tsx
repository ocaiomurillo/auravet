import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, servicesApi } from '../lib/apiClient';
import type { Animal, Attendance, AttendanceStatus, AttendanceType, OwnerSummary } from '../types/api';
import { getAttendanceTotal } from '../utils/attendance';
import { buildAttendancePdf } from '../utils/attendancePdf';
import { createXlsxBlob, downloadBlob } from '../utils/xlsxExport';

const statusLabels: Record<AttendanceStatus, string> = {
  AGENDADO: 'Agendado',
  CONFIRMADO: 'Confirmado',
  CONCLUIDO: 'Concluído',
  CANCELADO: 'Cancelado',
};

const typeLabels: Partial<Record<AttendanceType | string, string>> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('pt-BR');

interface AttendanceFiltersState {
  status: AttendanceStatus | '';
  ownerId: string;
  animalId: string;
  from: string;
  to: string;
}

const buildQueryString = (filters: AttendanceFiltersState) => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  if (filters.animalId) params.set('animalId', filters.animalId);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

const AttendancesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasModule } = useAuth();
  const canEdit = hasModule('services:write');

  const [filters, setFilters] = useState<AttendanceFiltersState>({
    status: '',
    ownerId: '',
    animalId: '',
    from: '',
    to: '',
  });

  const queryString = useMemo(() => buildQueryString(filters), [filters]);

  const normalizedFilters = useMemo(
    () => ({
      status: filters.status || undefined,
      ownerId: filters.ownerId || undefined,
      animalId: filters.animalId || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
    [filters],
  );

  const { data: owners } = useQuery({
    queryKey: ['owners', 'basic'],
    queryFn: () => apiClient.get<OwnerSummary[]>('/owners/basic'),
  });

  const animalsQueryKey = useMemo(() => ['animals', filters.ownerId || 'all'], [filters.ownerId]);
  const { data: animals } = useQuery({
    queryKey: animalsQueryKey,
    queryFn: () =>
      filters.ownerId
        ? apiClient.get<Animal[]>(`/animals?ownerId=${filters.ownerId}`)
        : apiClient.get<Animal[]>('/animals'),
  });

  const {
    data: attendances,
    isLoading,
    error,
  } = useQuery<Attendance[], Error>({
    queryKey: ['attendances', queryString],
    queryFn: () => servicesApi.list(normalizedFilters),
  });

  const pdfMutation = useMutation({
    mutationFn: async (attendanceId: string) => {
      const attendance = await servicesApi.getById(attendanceId);
      await buildAttendancePdf(attendance);
    },
    onSuccess: () => {
      toast.success('PDF do atendimento gerado.');
    },
    onError: () => {
      toast.error('Não foi possível gerar o PDF. Tente novamente.');
    },
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AttendanceStatus }) =>
      servicesApi.update(id, { status }),
    onSuccess: () => {
      toast.success('Atendimento atualizado.');
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: () => {
      toast.error('Não foi possível atualizar o status agora.');
    },
  });

  const handleExport = () => {
    if (!attendances?.length) {
      toast.error('Nenhum atendimento para exportar com os filtros atuais.');
      return;
    }

    const headers = ['Data', 'Status', 'Tipo', 'Pet', 'Tutor', 'Responsável', 'Total'] as const;

    const rows = attendances.map((attendance) => [
      formatDateTime(attendance.data),
      statusLabels[attendance.status] ?? attendance.status,
      typeLabels[attendance.tipo] ?? attendance.tipo,
      attendance.animal?.nome ?? '—',
      attendance.animal?.owner?.nome ?? '—',
      attendance.responsavel?.nome ?? '—',
      getAttendanceTotal(attendance),
    ]);

    const blob = createXlsxBlob({ sheetName: 'Atendimentos', headers, rows });
    downloadBlob(blob, 'atendimentos.xlsx');
    toast.success('Exportação iniciada. Verifique seus downloads.');
  };

  const handleClearFilters = () => {
    setFilters({ status: '', ownerId: '', animalId: '', from: '', to: '' });
  };

  const handleStatusChange = (value: AttendanceStatus | '') => {
    setFilters((prev) => ({ ...prev, status: value }));
  };

  const handleOwnerChange = (ownerId: string) => {
    setFilters((prev) => ({ ...prev, ownerId, animalId: '' }));
  };

  const handleAnimalChange = (animalId: string) => {
    setFilters((prev) => ({ ...prev, animalId }));
  };

  const handleDateChange = (key: 'from' | 'to', value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (id: string) => {
    navigate(`/services/${id}/edit`);
  };

  const buildStatusBadge = (status: AttendanceStatus) => {
    const baseClass = 'rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide';
    const variants: Record<AttendanceStatus, string> = {
      AGENDADO: 'bg-amber-100 text-amber-800',
      CONFIRMADO: 'bg-brand-savia/70 text-brand-escuro',
      CONCLUIDO: 'bg-emerald-100 text-emerald-800',
      CANCELADO: 'bg-red-100 text-red-700',
    };

    return <span className={`${baseClass} ${variants[status]}`}>{statusLabels[status]}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Atendimentos</h1>
          <p className="text-sm text-brand-grafite/70">
            Visualize, filtre e gerencie todos os atendimentos da clínica em um só lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={handleExport}>
            Exportar Excel
          </Button>
          {canEdit ? (
            <Button asChild>
              <Link to="/new-service">Registrar atendimento</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <Card title="Filtros" description="Refine a lista por status, período, tutor ou pet.">
        <div className="grid gap-4 lg:grid-cols-4">
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(e) => handleStatusChange(e.target.value as AttendanceStatus | '')}
          >
            <option value="">Todos</option>
            {Object.entries(statusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <Field
            label="De"
            type="date"
            value={filters.from}
            onChange={(e) => handleDateChange('from', e.target.value)}
          />
          <Field
            label="Até"
            type="date"
            value={filters.to}
            onChange={(e) => handleDateChange('to', e.target.value)}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2">
            <SelectField label="Tutor" value={filters.ownerId} onChange={(e) => handleOwnerChange(e.target.value)}>
              <option value="">Todos</option>
              {owners?.map((owner) => (
                <option key={owner.id} value={owner.id}>
                  {owner.nome}
                </option>
              ))}
            </SelectField>
            <SelectField label="Pet" value={filters.animalId} onChange={(e) => handleAnimalChange(e.target.value)}>
              <option value="">Todos</option>
              {animals?.map((animal) => (
                <option key={animal?.id} value={animal?.id}>
                  {animal?.nome}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" variant="ghost" onClick={handleClearFilters}>
            Limpar filtros
          </Button>
        </div>
      </Card>

      <Card title="Lista de atendimentos" description="Ações rápidas para cada atendimento.">
        {isLoading ? <p>Carregando atendimentos...</p> : null}
        {error ? <p className="text-sm text-red-600">Não foi possível carregar os atendimentos.</p> : null}

        {!isLoading && !error && !attendances?.length ? (
          <p className="text-sm text-brand-grafite/70">Nenhum atendimento encontrado.</p>
        ) : null}

        <div className="space-y-3">
          {attendances?.map((attendance) => (
            <div key={attendance.id} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-montserrat text-lg font-semibold text-brand-escuro">
                      {typeLabels[attendance.tipo] ?? attendance.tipo}
                    </p>
                    {buildStatusBadge(attendance.status)}
                  </div>
                  <p className="text-sm text-brand-grafite/70">{formatDateTime(attendance.data)}</p>
                  <p className="text-sm font-semibold text-brand-escuro">
                    {formatCurrency(getAttendanceTotal(attendance))}
                  </p>
                  <p className="text-sm text-brand-grafite/80">
                    Pet: {attendance.animal?.nome ?? '—'} • Tutor: {attendance.animal?.owner?.nome ?? '—'}
                  </p>
                  {attendance.responsavel ? (
                    <p className="text-xs uppercase tracking-wide text-brand-grafite/60">
                      Responsável: {attendance.responsavel.nome}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                  <Button variant="secondary" onClick={() => pdfMutation.mutate(attendance.id)}>
                    Gerar PDF
                  </Button>
                  {canEdit ? (
                    <>
                      <Button variant="ghost" onClick={() => handleEdit(attendance.id)}>
                        Editar
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={updateStatus.isPending || attendance.status === 'CONCLUIDO'}
                        onClick={() => updateStatus.mutate({ id: attendance.id, status: 'CONCLUIDO' })}
                      >
                        Concluir
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={updateStatus.isPending || attendance.status === 'CANCELADO'}
                        onClick={() => updateStatus.mutate({ id: attendance.id, status: 'CANCELADO' })}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AttendancesPage;
