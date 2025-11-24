import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Card from '../components/Card';
import Button from '../components/Button';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import { invoicesApi, paymentConditionsApi } from '../lib/apiClient';
import { buildInvoicePdf } from '../utils/invoicePdf';
import type {
  Invoice,
  InvoiceInstallment,
  InvoiceListResponse,
  InvoiceStatus,
  PaymentConditionDetails,
  PaymentMethod,
} from '../types/api';

interface FilterState {
  status: string;
  from: string;
  to: string;
  dueStatus: 'all' | 'overdue' | 'onTime';
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'OUTROS', label: 'Outros' },
];

const normalizeDateInput = (value: string) => value.split('T')[0];

const ensureInstallments = (invoice: Invoice): InvoiceInstallment[] => {
  if (invoice.installments.length) {
    return [...invoice.installments].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }

  return [
    {
      id: `${invoice.id}-installment`,
      amount: invoice.total,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
    },
  ];
};

const summarizeInvoiceInstallments = (invoice: Invoice) => {
  const installments = ensureInstallments(invoice);
  const paidCount = installments.filter((installment) => installment.paidAt).length;
  const totalInstallments = installments.length;
  const nextDueDate =
    installments.find((installment) => !installment.paidAt)?.dueDate ??
    installments[installments.length - 1]?.dueDate ??
    invoice.dueDate;

  const lastPaymentAt = installments.reduce<string | null>((latest, installment) => {
    if (!installment.paidAt) return latest;

    if (!latest) return installment.paidAt;

    return new Date(installment.paidAt) > new Date(latest)
      ? installment.paidAt
      : latest;
  }, invoice.paidAt);

  const now = new Date();
  const overdue = installments.some(
    (installment) => !installment.paidAt && new Date(installment.dueDate) < now,
  );
  const paidLate = installments.some(
    (installment) =>
      installment.paidAt && new Date(installment.paidAt) > new Date(installment.dueDate),
  );
  const isPaid = invoice.status.slug === 'QUITADA' || paidCount === totalInstallments;

  const indicatorLabel = isPaid
    ? paidLate
      ? 'Pago após vencimento'
      : 'Pago em dia'
    : overdue
      ? 'Vencido'
      : 'Em dia';

  const indicatorTone: 'success' | 'warning' | 'danger' | 'info' = isPaid
    ? paidLate
      ? 'warning'
      : 'success'
    : overdue
      ? 'danger'
      : 'info';

  return {
    installments,
    paidCount,
    totalInstallments,
    nextDueDate,
    lastPaymentAt,
    overdue,
    paidLate,
    isPaid,
    indicatorLabel,
    indicatorTone,
  };
};

const indicatorClasses: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-brand-azul/10 text-brand-escuro',
};

const AccountingPage = () => {
  const [filters, setFilters] = useState<FilterState>({
    status: 'ABERTA',
    from: '',
    to: '',
    dueStatus: 'all',
  });
  const [draftFilters, setDraftFilters] = useState<FilterState>({
    status: 'ABERTA',
    from: '',
    to: '',
    dueStatus: 'all',
  });
  const [adjustingInvoice, setAdjustingInvoice] = useState<Invoice | null>(null);
  const [adjustDueDate, setAdjustDueDate] = useState('');
  const [adjustPaymentMethod, setAdjustPaymentMethod] = useState<PaymentMethod | ''>('');
  const [adjustPaymentConditionId, setAdjustPaymentConditionId] = useState('');
  const [adjustInterestPercent, setAdjustInterestPercent] = useState('0');
  const [adjustedInstallments, setAdjustedInstallments] = useState<
    Array<{ amount: number; dueDate: string }>
  >([]);
  const [adjustedTotal, setAdjustedTotal] = useState(0);
  const [generatingInvoiceId, setGeneratingInvoiceId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: statuses } = useQuery<InvoiceStatus[]>({
    queryKey: ['invoice-statuses'],
    queryFn: invoicesApi.statuses,
  });

  const paymentConditionsQuery = useQuery<PaymentConditionDetails[]>({
    queryKey: ['payment-conditions'],
    queryFn: paymentConditionsApi.list,
  });

  const invoicesQuery = useQuery<InvoiceListResponse, Error>({
    queryKey: ['accounting', 'invoices', filters],
    queryFn: () => invoicesApi.list({
      status: filters.status || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
    }),
  });

  const adjustInvoiceMutation = useMutation({
    mutationFn: (params: { invoiceId: string; payload: Parameters<typeof invoicesApi.adjust>[1] }) =>
      invoicesApi.adjust(params.invoiceId, params.payload),
    onSuccess: () => {
      toast.success('Fatura ajustada com sucesso.');
      setAdjustingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['accounting', 'invoices'] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível ajustar a fatura.');
    },
  });

  const invoices = useMemo(() => invoicesQuery.data?.invoices ?? [], [invoicesQuery.data]);
  const summary = invoicesQuery.data?.summary;
  const invoiceSummaries = useMemo(
    () => invoices.map((invoice) => ({ invoice, summary: summarizeInvoiceInstallments(invoice) })),
    [invoices],
  );

  const openInvoiceSummaries = useMemo(
    () => invoiceSummaries.filter(({ summary: invoiceSummary }) => !invoiceSummary.isPaid),
    [invoiceSummaries],
  );

  const paidInvoiceSummaries = useMemo(
    () => invoiceSummaries.filter(({ summary: invoiceSummary }) => invoiceSummary.isPaid),
    [invoiceSummaries],
  );

  const filteredInvoiceSummaries = useMemo(() => {
    const filteredByStatus = filters.status
      ? invoiceSummaries.filter(({ invoice }) => invoice.status.slug === filters.status)
      : invoiceSummaries;

    const filtered = filteredByStatus.filter(({ summary }) => {
      if (filters.dueStatus === 'all') return true;
      if (filters.dueStatus === 'overdue') return summary.overdue;
      return !summary.overdue;
    });

    return [...filtered].sort((a, b) => {
      const dateA = new Date(a.summary.nextDueDate).getTime();
      const dateB = new Date(b.summary.nextDueDate).getTime();
      return dateA - dateB;
    });
  }, [filters.dueStatus, filters.status, invoiceSummaries]);

  const nextDueDate = useMemo(() => {
    const dates = openInvoiceSummaries
      .map(({ summary: invoiceSummary }) => invoiceSummary.nextDueDate)
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .sort((a, b) => a - b);

    return dates[0] ? new Date(dates[0]) : null;
  }, [openInvoiceSummaries]);

  const latestPaymentDate = useMemo(() => {
    const dates = paidInvoiceSummaries
      .map(({ summary }) => summary.lastPaymentAt ?? null)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .sort((a, b) => b - a);

    return dates[0] ? new Date(dates[0]) : null;
  }, [paidInvoiceSummaries]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({ ...draftFilters });
  };

  const handleReset = () => {
    setDraftFilters({ status: 'ABERTA', from: '', to: '', dueStatus: 'all' });
    setFilters({ status: 'ABERTA', from: '', to: '', dueStatus: 'all' });
  };

  const handleGeneratePdf = async (invoice: Invoice) => {
    try {
      setGeneratingInvoiceId(invoice.id);
      const doc = await buildInvoicePdf(invoice, paymentConditionsQuery.data ?? []);
      const ownerSlug = slugify(invoice.owner.nome || 'tutor');
      const fileDate = new Date(invoice.dueDate).toISOString().split('T')[0];
      const fileName = `auravet-fatura-${ownerSlug || 'tutor'}-${fileDate}.pdf`;
      const blobUrl = doc.output('bloburl');
      const newWindow = window.open(blobUrl, '_blank', 'noopener,noreferrer');
      doc.save(fileName);

      if (newWindow) {
        toast.success('PDF da fatura gerado. Abrimos em nova aba e iniciamos o download.');
      } else {
        toast.success('PDF da fatura gerado. O download foi iniciado; permita pop-ups para visualizar.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar o PDF desta fatura.');
    } finally {
      setGeneratingInvoiceId(null);
    }
  };

  useEffect(() => {
    if (!adjustingInvoice) return;

    const baseDueDate = adjustDueDate || normalizeDateInput(adjustingInvoice.dueDate);
    const condition =
      paymentConditionsQuery.data?.find((item) => item.id === adjustPaymentConditionId) ?? null;
    const percent = Number(adjustInterestPercent) || 0;
    const totalWithInterest = Number((adjustingInvoice.total * (1 + percent / 100)).toFixed(2));

    const installmentsCount = condition?.parcelas ?? ensureInstallments(adjustingInvoice).length;
    const intervalDays = condition?.prazoDias ?? 0;
    const baseAmount = Number((totalWithInterest / installmentsCount).toFixed(2));

    const firstDueDate = new Date(baseDueDate);
    if (condition) {
      firstDueDate.setDate(firstDueDate.getDate() + (condition.prazoDias ?? 0));
    }

    let accumulated = 0;
    const schedule = Array.from({ length: installmentsCount }).map((_, index) => {
      const isLast = index === installmentsCount - 1;
      const amount = isLast
        ? Number((totalWithInterest - accumulated).toFixed(2))
        : baseAmount;
      accumulated += amount;

      const dueDate = new Date(firstDueDate);
      dueDate.setDate(dueDate.getDate() + intervalDays * index);

      return {
        amount,
        dueDate: normalizeDateInput(dueDate.toISOString()),
      };
    });

    setAdjustedTotal(totalWithInterest);
    setAdjustedInstallments(schedule);
  }, [
    adjustDueDate,
    adjustInterestPercent,
    adjustPaymentConditionId,
    adjustingInvoice,
    paymentConditionsQuery.data,
  ]);

  const handleOpenAdjust = (invoice: Invoice) => {
    setAdjustingInvoice(invoice);
    setAdjustDueDate(normalizeDateInput(invoice.dueDate));
    setAdjustPaymentMethod(invoice.paymentMethod ?? '');
    setAdjustPaymentConditionId(invoice.paymentConditionDetails?.id ?? '');
    setAdjustInterestPercent('0');
    setAdjustedTotal(invoice.total);
    setAdjustedInstallments(
      ensureInstallments(invoice).map((installment) => ({
        amount: installment.amount,
        dueDate: normalizeDateInput(installment.dueDate),
      })),
    );
  };

  const handleCloseAdjust = () => {
    setAdjustingInvoice(null);
    setAdjustedInstallments([]);
    setAdjustedTotal(0);
    setAdjustInterestPercent('0');
  };

  const handleAdjustSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!adjustingInvoice) return;

    const interestPercent = Number(adjustInterestPercent) || 0;
    const recalculatedDueDate =
      adjustedInstallments[0]?.dueDate || adjustDueDate || normalizeDateInput(adjustingInvoice.dueDate);

    adjustInvoiceMutation.mutate({
      invoiceId: adjustingInvoice.id,
      payload: {
        dueDate: recalculatedDueDate,
        paymentMethod: adjustPaymentMethod || null,
        paymentConditionId: adjustPaymentConditionId || null,
        interestPercent,
        installments: adjustedInstallments,
      },
    });
  };

  const handleQuickStatusFilter = (status: string) => {
    setDraftFilters((prev) => ({ ...prev, status }));
    setFilters((prev) => ({ ...prev, status }));
  };

  const handleQuickDueStatusFilter = (dueStatus: FilterState['dueStatus']) => {
    setDraftFilters((prev) => ({ ...prev, dueStatus }));
    setFilters((prev) => ({ ...prev, dueStatus }));
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
              {nextDueDate ? nextDueDate.toLocaleDateString('pt-BR') : 'Nenhuma conta em aberto.'}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-azul/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Último recebimento</p>
            <p className="text-sm text-brand-grafite/80">
              {latestPaymentDate
                ? latestPaymentDate.toLocaleDateString('pt-BR')
                : 'Ainda sem registros.'}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Filtrar faturas" description="Combine período e status para refinar a visão.">
        <div className="mb-2 flex flex-wrap gap-2">
          {[
            { label: 'Abertas', value: 'ABERTA' },
            { label: 'Quitadas', value: 'QUITADA' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleQuickStatusFilter(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                draftFilters.status === option.value
                  ? 'bg-brand-azul text-white shadow'
                  : 'bg-brand-azul/10 text-brand-escuro hover:bg-brand-azul/20'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            { label: 'Todas', value: 'all' },
            { label: 'Em dia', value: 'onTime' },
            { label: 'Vencidas', value: 'overdue' },
          ] satisfies Array<{ label: string; value: FilterState['dueStatus'] }>).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleQuickDueStatusFilter(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                draftFilters.dueStatus === option.value
                  ? 'bg-brand-azul text-white shadow'
                  : 'bg-brand-azul/10 text-brand-escuro hover:bg-brand-azul/20'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <form className="grid gap-4 md:grid-cols-5" onSubmit={handleSubmit}>
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

          <SelectField
            label="Vencimento"
            value={draftFilters.dueStatus}
            onChange={(event) =>
              setDraftFilters((prev) => ({ ...prev, dueStatus: event.target.value as FilterState['dueStatus'] }))
            }
          >
            <option value="all">Todas</option>
            <option value="onTime">Em dia</option>
            <option value="overdue">Vencidas</option>
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

      <Card
        title="Faturas"
        description="Visualize em um único lugar o que está em aberto ou já foi quitado."
      >
        {invoicesQuery.isLoading ? (
          <p className="text-sm text-brand-grafite/70">Carregando faturas...</p>
        ) : null}
        {invoicesQuery.isError ? (
          <p className="text-sm text-red-600">
            {invoicesQuery.error?.message ?? 'Não foi possível carregar as faturas.'}
          </p>
        ) : null}
        {!invoicesQuery.isLoading && filteredInvoiceSummaries.length === 0 ? (
          <p className="text-sm text-brand-grafite/70">
            Nenhuma fatura encontrada para os filtros selecionados.
          </p>
        ) : null}

        {filteredInvoiceSummaries.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredInvoiceSummaries.map(({ invoice, summary }) => {
              const paymentMethodLabel =
                paymentMethodOptions.find((option) => option.value === invoice.paymentMethod)?.label ??
                'Não definida';
              const statusTone =
                invoice.status.slug === 'QUITADA'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-brand-azul/10 text-brand-escuro';

              return (
                <div
                  key={invoice.id}
                  className="rounded-2xl border border-brand-azul/20 bg-white/90 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand-escuro">{invoice.owner.nome}</p>
                      <p className="text-xs text-brand-grafite/60">{invoice.owner.email}</p>
                      <p className="text-xs text-brand-grafite/60">
                        {summary.paidCount}/{summary.totalInstallments} parcelas
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${indicatorClasses[summary.indicatorTone]}`}
                      >
                        {summary.indicatorLabel}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusTone}`}
                      >
                        {invoice.status.name}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Valor</p>
                      <p className="font-semibold text-brand-escuro">
                        {currencyFormatter.format(invoice.total)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">
                        {summary.isPaid ? 'Recebido em' : 'Próximo vencimento'}
                      </p>
                      <p className="text-sm text-brand-grafite/80">
                        {summary.isPaid
                          ? summary.lastPaymentAt
                            ? new Date(summary.lastPaymentAt).toLocaleDateString('pt-BR')
                            : '—'
                          : summary.nextDueDate
                          ? new Date(summary.nextDueDate).toLocaleDateString('pt-BR')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">
                        Pagamento
                      </p>
                      <p className="text-sm text-brand-grafite/80">{paymentMethodLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={generatingInvoiceId === invoice.id}
                      onClick={() => handleGeneratePdf(invoice)}
                    >
                      {generatingInvoiceId === invoice.id ? 'Gerando...' : 'Gerar PDF'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={invoice.status.slug === 'QUITADA' || adjustInvoiceMutation.isPending}
                      onClick={() => handleOpenAdjust(invoice)}
                    >
                      Ajustar fatura
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </Card>

      <Modal
        open={Boolean(adjustingInvoice)}
        onClose={handleCloseAdjust}
        title="Ajustar fatura"
        description="Edite vencimento, condição de pagamento e juros para recalcular parcelas."
        actions={
          <>
            <Button variant="ghost" onClick={handleCloseAdjust}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="adjust-invoice-form"
              disabled={adjustInvoiceMutation.isPending}
            >
              {adjustInvoiceMutation.isPending ? 'Salvando...' : 'Salvar ajustes'}
            </Button>
          </>
        }
      >
        {adjustingInvoice ? (
          <form id="adjust-invoice-form" className="space-y-4" onSubmit={handleAdjustSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Vencimento"
                type="date"
                value={adjustDueDate}
                onChange={(event) => setAdjustDueDate(event.target.value)}
              />
              <SelectField
                label="Forma de pagamento"
                value={adjustPaymentMethod}
                onChange={(event) => setAdjustPaymentMethod(event.target.value as PaymentMethod)}
              >
                <option value="">Manter padrão</option>
                {paymentMethodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>

            <SelectField
              label="Condição de pagamento"
              value={adjustPaymentConditionId}
              onChange={(event) => setAdjustPaymentConditionId(event.target.value)}
            >
              <option value="">Manter condição atual</option>
              {paymentConditionsQuery.data?.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.nome} ({condition.parcelas}x • {condition.prazoDias} dias)
                </option>
              ))}
            </SelectField>
            {paymentConditionsQuery.isLoading ? (
              <p className="text-xs text-brand-grafite/60">Carregando condições disponíveis...</p>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Juros (%)"
                type="number"
                step="0.1"
                min={0}
                value={adjustInterestPercent}
                onChange={(event) => setAdjustInterestPercent(event.target.value)}
              />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">
                  Total ajustado
                </p>
                <p className="text-lg font-semibold text-brand-escuro">
                  {currencyFormatter.format(adjustedTotal)}
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-brand-azul/5 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">
                  Parcelas recalculadas
                </p>
                <p className="text-xs text-brand-grafite/70">
                  {adjustedInstallments.length} parcela(s)
                </p>
              </div>
              <ul className="mt-2 space-y-2">
                {adjustedInstallments.map((installment, index) => (
                  <li
                    key={`${installment.dueDate}-${installment.amount}-${index}`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    <span className="font-semibold text-brand-escuro">Parcela {index + 1}</span>
                    <span className="text-brand-grafite/80">
                      {currencyFormatter.format(installment.amount)} •{' '}
                      {new Date(installment.dueDate).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </form>
        ) : null}
      </Modal>
    </div>
  );
};

export default AccountingPage;
