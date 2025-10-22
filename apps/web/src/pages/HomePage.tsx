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

  const canViewServices = hasModule('services:read');
  const canViewOwners = hasModule('owners:read');
  const canViewAnimals = hasModule('animals:read');
  const canViewProducts = hasModule('products:read');
  const canViewReceivables = hasModule('cashier:access');
  const canCreateServices = hasModule('services:write');

  const shouldFetchSummary =
    canViewServices || canViewOwners || canViewAnimals || canViewProducts || canViewReceivables;

  const summaryQuery = useQuery<DashboardSummaryResponse, Error>({
    queryKey: ['dashboard', 'summary'],
    queryFn: dashboardApi.summary,
    enabled: shouldFetchSummary,
    staleTime: 60_000,
  });

  const formatter = useMemo(() => new Intl.NumberFormat('pt-BR'), []);
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
        description="Na Auravet, seu pet é cuidado com ciência e carinho. Centralize cadastros, históricos e serviços em um fluxo leve e sustentável."
        className="md:col-span-2"
        actions={
          canCreateServices ? (
            <Button asChild variant="primary">
              <Link to="/new-service" className="flex items-center gap-2">
                <PlusCircleIcon className="h-5 w-5" /> Registrar Atendimento
              </Link>
            </Button>
          ) : null
        }
      >
        <p>
          Acompanhe tutores, pets e serviços em tempo real. Cada registro fortalece o vínculo entre conhecimento técnico e
          afeto — a essência do nosso cuidado.
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
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(owners.total)}</dd>
              </div>
            </dl>
          ))}
          <p>Conheça quem confia a energia dos pets à Auravet e acompanhe seus vínculos com cada animal.</p>
        </Card>
      ) : null}

      {canViewAnimals ? (
        <Card
          title="Animais"
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
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(animals.total)}</dd>
              </div>
            </dl>
          ))}
          <p>Cada pet é único. Mantenha dados completos e acione rapidamente os serviços vinculados.</p>
        </Card>
      ) : null}

      {canViewServices ? (
        <Card
          title="Serviços"
          description="Monitore consultas, exames, vacinas e cirurgias com filtros inteligentes."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/services" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.appointments, (appointments) => (
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Agendadas</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(appointments.scheduled)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Confirmadas</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(appointments.confirmed)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Concluídas</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(appointments.completed)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Próximos 7 dias</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(appointments.upcomingWeek)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Atendimentos hoje</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(appointments.today)}</dd>
              </div>
            </dl>
          ))}
          <p>Garanta uma jornada de cuidado contínuo, com visão clara de próximos passos e registros completos.</p>
        </Card>
      ) : null}

      {canViewReceivables ? (
        <Card
          title="Financeiro"
          description="Visualize rapidamente a saúde das contas a receber e priorize cobranças essenciais."
          actions={
            <Button variant="secondary" asChild>
              <Link to="/cashier" className="flex items-center gap-2">
                <ArrowRightCircleIcon className="h-5 w-5" /> Acessar
              </Link>
            </Button>
          }
        >
          {renderMetrics(summary?.receivables, (receivables) => (
            <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Em aberto</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">
                  {currencyFormatter.format(receivables.openTotal)}
                </dd>
                <p className="text-xs text-brand-grafite/70">
                  {formatter.format(receivables.openCount)} contas
                </p>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Quitadas</dt>
                <dd className="text-2xl font-semibold text-brand-escuro">
                  {currencyFormatter.format(receivables.paidTotal)}
                </dd>
                <p className="text-xs text-brand-grafite/70">
                  {formatter.format(receivables.paidCount)} contas
                </p>
              </div>
            </dl>
          ))}
          <p>Antecipe fluxos financeiros, reduza inadimplências e mantenha o caixa sempre saudável.</p>
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
                  <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(products.critical)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Em atenção</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(products.lowStock)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Ativos no catálogo</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(products.totalActive)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Com estoque saudável</dt>
                  <dd className="text-2xl font-semibold text-brand-escuro">{formatter.format(healthy)}</dd>
                </div>
              </dl>
            );
          })}
          <p>Identifique reposições com antecedência e evite rupturas em momentos críticos do cuidado.</p>
        </Card>
      ) : null}
    </div>
  );
};

export default HomePage;
