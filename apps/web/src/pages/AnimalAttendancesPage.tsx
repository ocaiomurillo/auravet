import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { useAuth } from '../contexts/AuthContext';
import { animalsApi } from '../lib/apiClient';
import type { Attendance, AttendanceStatus, AttendanceType } from '../types/api';
import { getAttendanceTotal } from '../utils/attendance';
import { buildOwnerAddress, formatCpf } from '../utils/owner';

const attendanceTypeLabels: Record<AttendanceType, string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const statusLabels: Record<AttendanceStatus, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CANCELADO: 'Cancelado',
  CONCLUIDO: 'Concluído',
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDateTime = (isoDate: string) => new Date(isoDate).toLocaleString('pt-BR');

const filterByDate = (attendanceDate: string, from: string, to: string) => {
  if (!from && !to) return true;
  const date = new Date(attendanceDate);
  const isAfterStart = from ? date >= new Date(from) : true;
  const isBeforeEnd = to ? date <= new Date(`${to}T23:59:59.999Z`) : true;
  return isAfterStart && isBeforeEnd;
};

const AnimalAttendancesPage = () => {
  const navigate = useNavigate();
  const { hasModule } = useAuth();
  const params = useParams<{ id: string }>();

  const animalId = params.id;
  const canManageAttendances = hasModule('attendances:manage');

  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: animal, isLoading: loadingAnimal } = useQuery({
    queryKey: ['animal', animalId],
    queryFn: () => animalsApi.getById(animalId ?? ''),
    enabled: Boolean(animalId),
  });

  const {
    data: attendances,
    isLoading: loadingAttendances,
    error: attendancesError,
  } = useQuery<Attendance[], Error>({
    queryKey: ['animal-services', animalId],
    queryFn: () => animalsApi.services(animalId ?? ''),
    enabled: Boolean(animalId),
  });

  const filteredAttendances = useMemo(() => {
    if (!attendances) return [];

    return attendances.filter((attendance) => {
      const matchesStatus = statusFilter ? attendance.status === statusFilter : true;
      const matchesDate = filterByDate(attendance.data, from, to);
      return matchesStatus && matchesDate;
    });
  }, [attendances, from, statusFilter, to]);

  const owner = animal?.owner ?? null;
  const ownerCpf = formatCpf(owner?.cpf);
  const ownerAddress = owner ? buildOwnerAddress(owner) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-brand-grafite/70">
            <button className="text-brand-azul underline" type="button" onClick={() => navigate(-1)}>
              Voltar
            </button>
          </p>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Atendimentos do pet</h1>
          <p className="text-sm text-brand-grafite/70">
            Histórico consolidado do pet com filtros rápidos para encontrar atendimentos específicos.
          </p>
        </div>
        {canManageAttendances ? (
          <Button variant="secondary" asChild>
            <Link to="/attendances/new">Registrar novo atendimento</Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr,2fr]">
        <div className="space-y-6">
          <Card title="Pet" description="Dados principais para confirmar que você está no prontuário correto.">
            {loadingAnimal ? <p>Carregando pet...</p> : null}
            {animal ? (
              <div className="space-y-2">
                <p className="font-montserrat text-lg font-semibold text-brand-escuro">{animal.nome}</p>
                <p className="text-sm text-brand-grafite/70">
                  {animal.especie} {animal.raca ? `• ${animal.raca}` : ''}
                </p>
                {animal.nascimento ? (
                  <p className="text-xs uppercase tracking-wide text-brand-grafite/60">
                    Nascimento: {new Date(animal.nascimento).toLocaleDateString('pt-BR')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card title="Tutor" description="Contatos rápidos do responsável pelo pet.">
            {owner ? (
              <div className="space-y-1 text-sm text-brand-grafite/80">
                <p className="font-semibold text-brand-escuro">{owner.nome}</p>
                <p>{owner.email}</p>
                {owner.telefone ? <p>{owner.telefone}</p> : null}
                {ownerCpf ? <p>CPF: {ownerCpf}</p> : null}
                {ownerAddress ? <p>{ownerAddress}</p> : null}
              </div>
            ) : (
              <p className="text-sm text-brand-grafite/70">Nenhum tutor vinculado.</p>
            )}
          </Card>

          <Card title="Filtros" description="Refine o histórico por período e status.">
            <div className="space-y-3">
              <SelectField label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AttendanceStatus | '')}>
                <option value="">Todos</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="De" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <Field label="Até" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setStatusFilter('');
                    setFrom('');
                    setTo('');
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <Card title="Histórico de atendimentos" description="Veja detalhes rápidos e acesse o atendimento completo.">
          {loadingAttendances ? <p>Carregando atendimentos...</p> : null}
          {attendancesError ? (
            <p className="text-sm text-red-600">Não foi possível carregar os atendimentos do pet.</p>
          ) : null}

          {!loadingAttendances && filteredAttendances.length === 0 ? (
            <p className="text-sm text-brand-grafite/70">Nenhum atendimento encontrado para os filtros selecionados.</p>
          ) : null}

          {filteredAttendances.length ? (
            <ul className="space-y-3">
              {filteredAttendances.map((attendance) => (
                <li key={attendance.id} className="rounded-2xl border border-brand-azul/30 bg-white/80 p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-montserrat text-lg font-semibold text-brand-escuro">
                          {attendanceTypeLabels[attendance.tipo] ?? attendance.tipo}
                        </p>
                        <span className="rounded-full bg-brand-azul/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-grafite/80">
                          {statusLabels[attendance.status]}
                        </span>
                      </div>
                      <p className="text-sm text-brand-grafite/70">{formatDateTime(attendance.data)}</p>
                      <p className="text-sm font-semibold text-brand-escuro">
                        {formatCurrency(getAttendanceTotal(attendance))}
                      </p>
                      {attendance.responsavel ? (
                        <p className="text-sm text-brand-grafite/80">Responsável: {attendance.responsavel.nome}</p>
                      ) : null}
                      {attendance.appointment ? (
                        <p className="text-xs text-brand-grafite/60">
                          Agendamento: {formatDateTime(attendance.appointment.scheduledStart)} -{' '}
                          {formatDateTime(attendance.appointment.scheduledEnd)}
                        </p>
                      ) : null}
                      {attendance.catalogItems.length ? (
                        <p className="text-xs text-brand-grafite/70">
                          Serviços: {attendance.catalogItems.map((item) => item.definition.nome).join(', ')}
                        </p>
                      ) : null}
                      {attendance.observacoes ? (
                        <p className="text-sm text-brand-grafite/80">{attendance.observacoes}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button variant="ghost" asChild>
                        <Link to={`/attendances/${attendance.id}/edit?mode=view`}>Visualizar</Link>
                      </Button>
                      {canManageAttendances ? (
                        <Button asChild>
                          <Link to={`/attendances/${attendance.id}/edit`}>Editar</Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default AnimalAttendancesPage;
