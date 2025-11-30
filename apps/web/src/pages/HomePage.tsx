import { ArrowRightCircleIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';

import Button from '../components/Button';
import Card from '../components/Card';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../lib/apiClient';
import type { DashboardSummaryResponse } from '../types/api';

const HomePage = () => {
  const { user, hasModule } = useAuth();

  const canViewAppointments = hasModule('appointments:manage');
  const canViewAttendances = hasModule('attendances:manage');
  const canViewOwners = hasModule('owners:read');
  const canViewAnimals = hasModule('animals:read');
  const canViewProducts = hasModule('products:read');
  const canViewAccounting = hasModule('accounting:manage');
  const canViewCashier = hasModule('cashier:manage');
  const canViewFinance = canViewAccounting || canViewCashier;
  const canCreateAttendances = hasModule('services:write');

  const shouldFetchSummary =
    canViewAppointments ||
    canViewAttendances ||
    canViewOwners ||
    canViewAnimals ||
    canViewProducts ||
    canViewFinance;

  const summaryQuery = useQuery<DashboardSummaryResponse, Error>({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.summary,
    enabled: shouldFetchSummary,
    staleTime: 60_000,
  });

  const numberFormatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }),
    [],
  );
  const summary = summaryQuery.data?.summary;

  const renderMetrics = <T,>(data: T | undefined, render: (value: T) => ReactNode) => {
    if (!shouldFetchSummary) {
      return null;
    }

    if (summaryQuery.isLoading) {
      return <p className="text-sm text-brand-grafite/70">Carregando métricas...</p>;
    }

    if (summaryQuery.isError) {
      return (
        <p className="text-sm text-red-600">
          {summaryQuery.error?.message ?? 'Não foi possível carregar as métricas do painel.'}
        </p>
      );
    }

    if (!data) {
      return <p className="text-sm text-brand-grafite/70">Nenhuma métrica disponível até o momento.</p>;
    }

    return render(data);
  };

  const welcomeTitle = user ? `Bem-vindo(a), ${user.nome}` : 'Bem-vinda, equipe Auravet';

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card
        title={welcomeTitle}
        description="Na Auravet, seu pet é cuidado com ciência e carinho. Centralize cadastros, históricos e atendimentos em um fluxo leve e sustentável."
        className="md:col-span-2"
        actions={
          canCreateAttendances ? (
            <Button asChild variant="primary">
              <Link to="/new-service" className="flex items-center gap-2">
                <PlusCircleIcon className="h-5 w-5" /> Atendimento
              </Link>
            </Button>
          ) : null
        }
      >
          <p>
            Acompanhe tutores, pets e atendimentos em tempo real. Cada registro fortalece o vínculo entre conhecimento técnico
            e afeto — a essência do nosso cuidado.
          </p>
      </Card>

      {canViewOwners ? (
        <Card
          title="Tutores"
          description="Cadastre novos tutores e mantenha contatos sempre atualizados."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/owners" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.owners, (owners) => (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Total cadastrados</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(owners.total)}</dd>
              </div>
            </dl>
          ))}
          <p>Conheça quem confia a energia dos pets à Auravet e acompanhe seus vínculos com cada animal.</p>
        </Card>
      ) : null}

      {canViewAnimals ? (
        <Card
          title="Pets"
          description="Visualize prontuários, histórico e datas importantes."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/animals" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.animals, (animals) => (
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Pets cadastrados</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(animals.total)}</dd>
              </div>
            </dl>
          ))}
          <p>Cada pet é único. Mantenha dados completos e acione rapidamente os atendimentos vinculados.</p>
        </Card>
      ) : null}

      {canViewAppointments ? (
        <Card
          title="Agendamentos"
          description="Visualize compromissos e acompanhe confirmações e cancelamentos."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/appointments" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.appointments, (appointments) => {
            const status = appointments.status ?? {
              scheduled: appointments.scheduled,
              confirmed: appointments.confirmed,
              cancelled: appointments.cancelled,
              completed: appointments.completed,
            };
            const timeframe = appointments.timeframe ?? {
              today: appointments.today,
              upcomingWeek: appointments.upcomingWeek,
            };

            return (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Agendados</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.scheduled ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Confirmados</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.confirmed ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Cancelados</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.cancelled ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Concluídos</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.completed ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Hoje</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(timeframe.today ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Próximos 7 dias</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(timeframe.upcomingWeek ?? 0)}
                  </dd>
                </div>
              </dl>
            );
          })}
          <p>Garanta uma agenda fluida, antecipando confirmações e redistribuições conforme a demanda.</p>
        </Card>
      ) : null}

      {canViewAttendances ? (
        <Card
          title="Atendimentos"
          description="Monitore execução de serviços e acompanhe entregas em tempo real."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/attendances" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.services, (services) => {
            const status = services.status ?? {
              ongoing: services.ongoing,
              completed: services.completed,
              cancelled: services.cancelled,
            };
            const todaysServices = services.performance?.today;
            const total = services.total ??
              ((status.ongoing ?? 0) + (status.completed ?? 0) + (status.cancelled ?? 0));

            return (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Total registrados</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(total)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Em andamento</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.ongoing ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Concluídos</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.completed ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Cancelados</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(status.cancelled ?? 0)}
                  </dd>
                </div>
                {todaysServices !== undefined ? (
                  <div>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Realizados hoje</dt>
                    <dd className="text-2xl font-semibold text-brand-escuro">
                      {numberFormatter.format(todaysServices ?? 0)}
                    </dd>
                  </div>
                ) : null}
              </dl>
            );
          })}
          <p>Conecte consultas, exames e cirurgias para acompanhar produtividade e resolutividade da equipe.</p>
        </Card>
      ) : null}

      {canViewProducts ? (
        <Card
          title="Produtos"
          description="Acompanhe o estoque e mantenha itens essenciais sempre disponíveis."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/products" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.products, (products) => {
            const healthy = Math.max(products.totalActive - products.critical - products.lowStock, 0);

            return (
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Críticos</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(products.critical)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Em atenção</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(products.lowStock)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Ativos no catálogo</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(products.totalActive)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Com estoque saudável</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{numberFormatter.format(healthy)}</dd>
                </div>
              </dl>
            );
          })}
          <p>Identifique reposições com antecedência e evite rupturas em momentos críticos do cuidado.</p>
        </Card>
      ) : null}

      {canViewFinance ? (
        <Card
          title="Faturas"
          description="Visualize recebíveis, acompanhe status de cobrança e antecipe vencimentos."
          actions={
            <Button variant="secondary" asChild>
              <Link to={canViewAccounting ? '/accounting' : '/cashier'} className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.invoices, (invoices) => {
            const status = invoices.status ?? {
              blocked: invoices.blocked,
              open: invoices.open,
              partiallyPaid: invoices.partiallyPaid,
              paid: invoices.paid,
              overdue: invoices.overdue,
            };
            const receivables = invoices.receivables ?? {};
            const receivableTotal = invoices.receivableTotal ?? 0;
            const overdueTotal = invoices.overdueTotal ?? 0;
            const receivedTotal = invoices.receivedTotal ?? receivables.receivedTotal ?? 0;

            const openCount = status.open ?? invoices.open ?? 0;
            const partiallyPaidCount = status.partiallyPaid ?? invoices.partiallyPaid ?? 0;
            const paidCount = status.paid ?? invoices.paid ?? 0;
            const blockedCount = status.blocked ?? invoices.blocked ?? 0;
            const overdueCount = status.overdue ?? invoices.overdue;
            const hasOverdue = overdueCount !== undefined || overdueTotal > 0;
            const hasDueToday = receivables.dueToday !== undefined;
            const hasDueSoon = receivables.dueSoon !== undefined;

            return (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Recebido</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {currencyFormatter.format(receivedTotal)}
                  </dd>
                  <p className="text-xs text-brand-grafite/70">
                    Faturas pagas: {numberFormatter.format(paidCount)}
                  </p>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">A receber</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {currencyFormatter.format(receivableTotal)}
                  </dd>
                  <p className="text-xs text-brand-grafite/70">
                    Em aberto e parciais: {numberFormatter.format(openCount + partiallyPaidCount)}
                  </p>
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Vencidas</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {currencyFormatter.format(overdueTotal)}
                  </dd>
                  {hasOverdue ? (
                    <p className="text-xs text-brand-grafite/70">
                      Faturas vencidas: {numberFormatter.format(overdueCount ?? 0)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Bloqueadas</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">
                    {numberFormatter.format(blockedCount)}
                  </dd>
                </div>
                {hasDueToday || hasDueSoon ? (
                  <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
                    {hasDueToday ? (
                      <div className="space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Vencem hoje</dt>
                        <dd className="text-lg font-semibold text-brand-escuro">
                          {numberFormatter.format(receivables.dueToday ?? 0)}
                        </dd>
                      </div>
                    ) : null}
                    {hasDueSoon ? (
                      <div className="space-y-1">
                        <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Próximos vencimentos</dt>
                        <dd className="text-lg font-semibold text-brand-escuro">
                          {numberFormatter.format(receivables.dueSoon ?? 0)}
                        </dd>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </dl>
            );
          })}
          <p>Centralize cobrança e recebimentos para manter previsibilidade e saúde financeira.</p>
        </Card>
      ) : null}
    </div>
  );
};

export default HomePage;
