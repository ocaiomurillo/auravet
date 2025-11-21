import { type FormEvent, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import Card from '../components/Card';
import Field from '../components/Field';
import SelectField from '../components/SelectField';
import { invoicesApi } from '../lib/apiClient';
import type { InvoiceListResponse, InvoiceStatus } from '../types/api';

interface FilterState {
  status: string;
  from: string;
  to: string;
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const AccountingPage = () => {
  const [filters, setFilters] = useState<FilterState>({ status: '', from: '', to: '' });
  const [draftFilters, setDraftFilters] = useState<FilterState>({ status: '', from: '', to: '' });

  const { data: statuses } = useQuery<InvoiceStatus[]>({
    queryKey: ['invoice-statuses'],
    queryFn: invoicesApi.statuses,
  });

  const invoicesQuery = useQuery<InvoiceListResponse, Error>({
    queryKey: ['accounting', 'invoices', filters],
    queryFn: () => invoicesApi.list({
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
  });

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data]);
  const summary = invoicesQuery.data?.summary;

  const receivedInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => invoice.paidAt || invoice.status.slug === 'QUITADA')
      .sort((a, b) => {
        const dateA = new Date(a.paidAt ?? a.updatedAt).getTime();
        const dateB = new Date(b.paidAt ?? b.updatedAt).getTime();
        return dateB - dateA;
      });
  }, [invoices]);

  const openInvoices = useMemo(() => {
    return invoices
      .filter((invoice) => !invoice.paidAt && invoice.status.slug !== 'QUITADA')
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }, [invoices]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draftFilters });
  };

  const handleReset = () => {
    setDraftFilters({ status: '', from: '', to: '' });
    setFilters({ status: '', from: '', to: '' });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Financeiro</h1>
        <p className="text-sm text-brand-grafite/70">
          Visualize rapidamente contas emitidas, receitas recebidas e o que ainda está para vencer.
        </p>
      </div>

      <Card
        title="Resumo de receitas"
        description="Acompanhe totais quitados e em aberto para manter o fluxo de caixa saudável."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-emerald-100/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Recebido</p>
            <p className="text-xl font-semibold text-emerald-700">
              {currencyFormatter.format(summary?.paidTotal ?? 0)}
            </p>
            <p className="text-xs text-brand-grafite/70">{summary?.paidCount ?? 0} faturas quitadas</p>
          </div>
          <div className="rounded-2xl bg-brand-azul/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">A receber</p>
            <p className="text-xl font-semibold text-brand-escuro">
              {currencyFormatter.format(summary?.openTotal ?? 0)}
            </p>
            <p className="text-xs text-brand-grafite/70">{summary?.openCount ?? 0} contas pendentes</p>
          </div>
          <div className="rounded-2xl bg-brand-azul/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Próximo vencimento</p>
            <p className="text-sm text-brand-grafite/80">
              {openInvoices[0]?.dueDate
                ? new Date(openInvoices[0].dueDate).toLocaleDateString('pt-BR')
                : 'Nenhuma conta em aberto.'}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-azul/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Último recebimento</p>
            <p className="text-sm text-brand-grafite/80">
              {receivedInvoices[0]?.paidAt
                ? new Date(receivedInvoices[0].paidAt ?? receivedInvoices[0].updatedAt).toLocaleDateString('pt-BR')
                : 'Ainda sem registros.'}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Filtrar faturas" description="Combine período e status para refinar a visão.">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
          <SelectField
            label="Status"
            value={draftFilters.status}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="">Todos os status</option>
            {statuses?.map((status) => (
              <option key={status.id} value={status.slug}>
                {status.name}
              </option>
            ))}
          </SelectField>

          <Field
            label="De"
            type="date"
            value={draftFilters.from}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, from: event.target.value }))}
          />

          <Field
            label="Até"
            type="date"
            value={draftFilters.to}
            onChange={(event) => setDraftFilters((prev) => ({ ...prev, to: event.target.value }))}
          />

          <div className="flex items-end gap-3">
            <button
              type="submit"
              className="rounded-xl bg-brand-azul px-4 py-2 text-sm font-semibold text-white shadow hover:bg-brand-azul/90 focus:outline-none focus:ring-2 focus:ring-brand-azul/40"
            >
              Aplicar filtros
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-brand-escuro hover:bg-brand-azul/10 focus:outline-none focus:ring-2 focus:ring-brand-azul/30"
            >
              Limpar
            </button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="A receber" description="Contas em aberto aguardando pagamento.">
          {invoicesQuery.isLoading ? (
            <p className="text-sm text-brand-grafite/70">Carregando contas...</p>
          ) : null}
          {invoicesQuery.isError ? (
            <p className="text-sm text-red-600">
              {invoicesQuery.error?.message ?? 'Não foi possível carregar as contas a receber.'}
            </p>
          ) : null}
          {!invoicesQuery.isLoading && openInvoices.length === 0 ? (
            <p className="text-sm text-brand-grafite/70">Nenhuma conta em aberto para os filtros selecionados.</p>
          ) : null}

          {openInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-azul/20">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-brand-grafite/60">
                    <th className="px-3 py-2">Tutor</th>
                    <th className="px-3 py-2">Vencimento</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-azul/10">
                  {openInvoices.map((invoice) => (
                    <tr key={invoice.id} className="text-sm text-brand-grafite/80">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-brand-escuro">{invoice.owner.nome}</p>
                        <p className="text-xs text-brand-grafite/60">{invoice.owner.email}</p>
                      </td>
                      <td className="px-3 py-2">{new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</td>
                      <td className="px-3 py-2 font-semibold text-brand-escuro">
                        {currencyFormatter.format(invoice.total)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-brand-azul/10 px-3 py-1 text-xs font-semibold text-brand-escuro">
                          {invoice.status.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>

        <Card title="Recebidas" description="Faturas quitadas e valores já contabilizados.">
          {invoicesQuery.isLoading ? (
            <p className="text-sm text-brand-grafite/70">Carregando faturas...</p>
          ) : null}
          {invoicesQuery.isError ? (
            <p className="text-sm text-red-600">
              {invoicesQuery.error?.message ?? 'Não foi possível carregar as faturas quitadas.'}
            </p>
          ) : null}
          {!invoicesQuery.isLoading && receivedInvoices.length === 0 ? (
            <p className="text-sm text-brand-grafite/70">Nenhum recebimento encontrado para os filtros.</p>
          ) : null}

          {receivedInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-brand-azul/20">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-brand-grafite/60">
                    <th className="px-3 py-2">Tutor</th>
                    <th className="px-3 py-2">Recebido em</th>
                    <th className="px-3 py-2">Valor</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-azul/10">
                  {receivedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="text-sm text-brand-grafite/80">
                      <td className="px-3 py-2">
                        <p className="font-semibold text-brand-escuro">{invoice.owner.nome}</p>
                        <p className="text-xs text-brand-grafite/60">{invoice.owner.email}</p>
                      </td>
                      <td className="px-3 py-2">
                        {invoice.paidAt
                          ? new Date(invoice.paidAt).toLocaleDateString('pt-BR')
                          : new Date(invoice.updatedAt).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="px-3 py-2 font-semibold text-emerald-700">
                        {currencyFormatter.format(invoice.total)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          {invoice.status.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
};

export default AccountingPage;
