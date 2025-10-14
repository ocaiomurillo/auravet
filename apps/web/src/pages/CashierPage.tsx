import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import type { Invoice, InvoiceListResponse, Owner, Service } from '../types/api';
import { apiClient, invoicesApi } from '../lib/apiClient';
import { buildOwnerAddress, formatCpf } from '../utils/owner';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const serviceLabels: Record<Service['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

type InvoiceFiltersState = {
  ownerId: string;
  status: string;
  from: string;
  to: string;
};

const CashierPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InvoiceFiltersState>({ ownerId: '', status: '', from: '', to: '' });
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [ownerForModal, setOwnerForModal] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const selectedInvoiceOwnerCpf = selectedInvoice ? formatCpf(selectedInvoice.owner.cpf) : null;
  const selectedInvoiceOwnerAddress = selectedInvoice ? buildOwnerAddress(selectedInvoice.owner) : null;
  const [paymentNotes, setPaymentNotes] = useState('');

  const { data: owners } = useQuery({
    queryKey: ['owners'],
    queryFn: () => apiClient.get<Owner[]>('/owners'),
  });

  const { data: statuses } = useQuery({
    queryKey: ['invoice-statuses'],
    queryFn: () => invoicesApi.statuses(),
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.ownerId) params.set('ownerId', filters.ownerId);
    if (filters.status) params.set('status', filters.status);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [filters]);

  const { data: invoicesResponse, isLoading, error, refetch } = useQuery<InvoiceListResponse>({
    queryKey: ['invoices', queryString],
    queryFn: () => apiClient.get<InvoiceListResponse>(`/invoices${queryString}`),
  });

  const candidateServicesQuery = useQuery<Service[]>({
    queryKey: ['invoice-candidates', ownerForModal],
    queryFn: () => invoicesApi.candidates(ownerForModal || undefined),
    enabled: isGenerateModalOpen,
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { serviceId: string; dueDate?: string }) => invoicesApi.generateFromService(payload),
    onSuccess: (invoice) => {
      toast.success('Conta emitida com carinho.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-candidates'] });
      setIsGenerateModalOpen(false);
      setSelectedServiceId('');
      setOwnerForModal('');
      setDueDate('');
      setSelectedInvoice(invoice);
      setPaymentNotes(invoice.paymentNotes ?? '');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível gerar a conta.');
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (payload: { id: string; paidAt?: string; paymentNotes?: string }) =>
      invoicesApi.markAsPaid(payload.id, { paidAt: payload.paidAt, paymentNotes: payload.paymentNotes }),
    onSuccess: (invoice) => {
      toast.success('Pagamento registrado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(invoice);
      setPaymentNotes(invoice.paymentNotes ?? '');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.');
    },
  });

  const invoices = invoicesResponse?.invoices ?? [];
  const summary = invoicesResponse?.summary;

  const selectedService = candidateServicesQuery.data?.find((service) => service.id === selectedServiceId);

  useEffect(() => {
    if (selectedService) {
      const baseDate = new Date(selectedService.data);
      baseDate.setDate(baseDate.getDate() + 7);
      setDueDate(baseDate.toISOString().slice(0, 10));
    } else {
      setDueDate('');
    }
  }, [selectedService]);

  useEffect(() => {
    if (!isGenerateModalOpen) {
      setSelectedServiceId('');
      setOwnerForModal('');
      setDueDate('');
    }
  }, [isGenerateModalOpen]);

  useEffect(() => {
    setSelectedServiceId('');
  }, [ownerForModal]);

  useEffect(() => {
    if (selectedInvoice) {
      setPaymentNotes(selectedInvoice.paymentNotes ?? '');
    }
  }, [selectedInvoice]);

  const handleFiltersSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    refetch();
  };

  const handleFiltersReset = () => {
    setFilters({ ownerId: '', status: '', from: '', to: '' });
  };

  const handleGenerateInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedServiceId) {
      toast.error('Selecione um serviço para gerar a conta.');
      return;
    }

    generateMutation.mutate({
      serviceId: selectedServiceId,
      dueDate: dueDate || undefined,
    });
  };

  const handleExportCsv = async () => {
    try {
      const csv = await invoicesApi.exportCsv({
        ownerId: filters.ownerId || undefined,
        status: filters.status || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
      });
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auravet-contas-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Exportação em CSV preparada com sucesso.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível exportar as contas.');
    }
  };

  const handleOpenInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentNotes(invoice.paymentNotes ?? '');
  };

  const handleCloseInvoice = () => {
    setSelectedInvoice(null);
    setPaymentNotes('');
  };

  const handleMarkAsPaid = () => {
    if (!selectedInvoice) return;

    markPaidMutation.mutate({
      id: selectedInvoice.id,
      paymentNotes: paymentNotes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-montserrat text-2xl font-semibold text-brand-escuro">Caixa</h1>
          <p className="text-sm text-brand-grafite/70">
            Acompanhe contas a receber, veja detalhes dos itens faturados e registre pagamentos com transparência.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setIsGenerateModalOpen(true)}>
            Emitir nova conta
          </Button>
          <Button variant="ghost" onClick={handleExportCsv}>
            Exportar CSV
          </Button>
        </div>
      </div>

      <Card
        title="Resumo financeiro"
        description="Visão rápida do que está em aberto e do que já foi quitado."
      >
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-brand-azul/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Total em aberto</p>
            <p className="text-xl font-semibold text-brand-escuro">
              {currencyFormatter.format(summary?.openTotal ?? 0)}
            </p>
            <p className="text-xs text-brand-grafite/70">{summary?.openCount ?? 0} contas aguardando pagamento</p>
          </div>
          <div className="rounded-2xl bg-emerald-100/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Total quitado</p>
            <p className="text-xl font-semibold text-emerald-700">
              {currencyFormatter.format(summary?.paidTotal ?? 0)}
            </p>
            <p className="text-xs text-brand-grafite/70">{summary?.paidCount ?? 0} contas recebidas</p>
          </div>
          <div className="rounded-2xl bg-brand-azul/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Próximos vencimentos</p>
            <p className="text-sm text-brand-grafite/80">
              {invoices
                .filter((invoice) => !invoice.paidAt)
                .slice(0, 3)
                .map((invoice) => new Date(invoice.dueDate).toLocaleDateString('pt-BR'))
                .join(' • ') || 'Sem contas próximas.'}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-azul/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/70">Responsáveis recentes</p>
            <p className="text-sm text-brand-grafite/80">
              {Array.from(
                new Set(
                  invoices
                    .map((invoice) => invoice.responsible?.nome)
                    .filter((nome): nome is string => Boolean(nome)),
                ),
              ).join(' • ') || 'Responsáveis serão exibidos após registrar pagamentos.'}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Filtrar contas" description="Encontre contas por tutor, status e período." >
        <form className="grid gap-4 md:grid-cols-4" onSubmit={handleFiltersSubmit}>
          <SelectField
            label="Tutor"
            value={filters.ownerId}
            onChange={(event) => setFilters((prev) => ({ ...prev, ownerId: event.target.value }))}
          >
            <option value="">Todos os tutores</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Status"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
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
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
          />

          <Field
            label="Até"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
          />

          <div className="flex gap-3 md:col-span-4">
            <Button type="submit">Aplicar filtros</Button>
            <Button type="button" variant="ghost" onClick={handleFiltersReset}>
              Limpar
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Contas a receber" description="Detalhes completos das contas emitidas para cada tutor.">
        {isLoading ? <p>Carregando contas...</p> : null}
        {error ? <p className="text-red-500">Não foi possível carregar as contas.</p> : null}
        {!isLoading && invoices.length === 0 ? (
          <p className="text-sm text-brand-grafite/70">Nenhuma conta encontrada para os filtros aplicados.</p>
        ) : null}
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-azul/20">
              <thead className="bg-brand-azul/10">
                <tr className="text-left text-sm font-semibold uppercase tracking-wide text-brand-grafite/70">
                  <th className="px-4 py-3">Tutor</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Vencimento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-azul/10 bg-white/90">
                {invoices.map((invoice) => {
                  const ownerCpf = formatCpf(invoice.owner.cpf);
                  const ownerAddress = buildOwnerAddress(invoice.owner);

                  return (
                    <tr key={invoice.id} className="text-sm text-brand-grafite/80">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-brand-escuro">{invoice.owner.nome}</p>
                        <p className="text-xs text-brand-grafite/60">{invoice.owner.email}</p>
                        {invoice.owner.telefone ? (
                          <p className="text-xs text-brand-grafite/60">{invoice.owner.telefone}</p>
                        ) : null}
                        {ownerCpf ? (
                          <p className="text-xs text-brand-grafite/60">CPF: {ownerCpf}</p>
                        ) : null}
                        {ownerAddress ? (
                          <p className="text-xs text-brand-grafite/60">{ownerAddress}</p>
                        ) : null}
                      </td>
                    <td className="px-4 py-3 font-semibold text-brand-escuro">
                      {currencyFormatter.format(invoice.total)}
                    </td>
                    <td className="px-4 py-3">
                      {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          invoice.status.slug === 'QUITADA'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {invoice.status.name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {invoice.responsible ? (
                        <>
                          <p className="font-semibold text-brand-escuro">{invoice.responsible.nome}</p>
                          <p className="text-xs text-brand-grafite/60">{invoice.responsible.email}</p>
                        </>
                      ) : (
                        <span className="text-xs text-brand-grafite/60">Aguardando registro</span>
                      )}
                    </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          className="px-3 py-1 text-xs"
                          onClick={() => handleOpenInvoice(invoice)}
                        >
                          Ver detalhes
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Modal
        open={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Emitir nova conta"
        description="Selecione o serviço realizado e personalize o vencimento da conta."
        actions={
          <>
            <Button variant="ghost" onClick={() => setIsGenerateModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="generate-invoice" disabled={generateMutation.isPending}>
              {generateMutation.isPending ? 'Gerando...' : 'Emitir conta'}
            </Button>
          </>
        }
      >
        <form id="generate-invoice" className="space-y-4" onSubmit={handleGenerateInvoice}>
          <SelectField
            label="Tutor"
            value={ownerForModal}
            onChange={(event) => setOwnerForModal(event.target.value)}
          >
            <option value="">Todos os tutores</option>
            {owners?.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.nome}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Serviço"
            value={selectedServiceId}
            onChange={(event) => setSelectedServiceId(event.target.value)}
          >
            <option value="">Selecione o serviço realizado</option>
            {candidateServicesQuery.data?.map((service) => (
              <option key={service.id} value={service.id}>
                {serviceLabels[service.tipo] ?? service.tipo} — {service.animal?.nome ?? 'Pet'} •
                {` ${new Date(service.data).toLocaleDateString('pt-BR')}`}
              </option>
            ))}
          </SelectField>
          {candidateServicesQuery.isLoading ? (
            <p className="text-xs text-brand-grafite/60">Buscando serviços disponíveis...</p>
          ) : null}
          {!candidateServicesQuery.isLoading && candidateServicesQuery.data?.length === 0 ? (
            <p className="text-xs text-brand-grafite/60">
              Nenhum serviço elegível encontrado para os filtros atuais.
            </p>
          ) : null}

          <Field
            label="Vencimento"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedInvoice)}
        onClose={handleCloseInvoice}
        title="Detalhes da conta"
        description="Veja itens faturados, valores e registre o pagamento quando necessário."
        actions={
          selectedInvoice?.status.slug === 'QUITADA' ? (
            <Button variant="ghost" onClick={handleCloseInvoice}>
              Fechar
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={handleCloseInvoice}>
                Fechar
              </Button>
              <Button onClick={handleMarkAsPaid} disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending ? 'Registrando...' : 'Registrar pagamento'}
              </Button>
            </>
          )
        }
      >
        {selectedInvoice ? (
          <div className="space-y-4 text-sm text-brand-grafite/80">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Tutor</p>
                <p className="text-brand-escuro">{selectedInvoice.owner.nome}</p>
                <p className="text-xs text-brand-grafite/60">{selectedInvoice.owner.email}</p>
                {selectedInvoice.owner.telefone ? (
                  <p className="text-xs text-brand-grafite/60">{selectedInvoice.owner.telefone}</p>
                ) : null}
                {selectedInvoiceOwnerCpf ? (
                  <p className="text-xs text-brand-grafite/60">CPF: {selectedInvoiceOwnerCpf}</p>
                ) : null}
                {selectedInvoiceOwnerAddress ? (
                  <p className="text-xs text-brand-grafite/60">{selectedInvoiceOwnerAddress}</p>
                ) : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Status</p>
                <p className="font-semibold text-brand-escuro">{selectedInvoice.status.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Total</p>
                <p className="font-semibold text-brand-escuro">
                  {currencyFormatter.format(selectedInvoice.total)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Vencimento</p>
                <p>{new Date(selectedInvoice.dueDate).toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Pagamento</p>
                <p>
                  {selectedInvoice.paidAt
                    ? new Date(selectedInvoice.paidAt).toLocaleDateString('pt-BR')
                    : 'Em aberto'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Responsável</p>
                <p>{selectedInvoice.responsible?.nome ?? 'Ainda não definido'}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-brand-azul/20 bg-brand-azul/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Itens faturados</p>
              <ul className="mt-3 space-y-3">
                {selectedInvoice.items.map((item) => (
                  <li key={item.id} className="rounded-xl bg-white/90 p-3 shadow-sm">
                    <p className="font-semibold text-brand-escuro">{item.description}</p>
                    <p className="text-xs text-brand-grafite/60">
                      {item.quantity} × {currencyFormatter.format(item.unitPrice)} ={' '}
                      {currencyFormatter.format(item.total)}
                    </p>
                    {item.service ? (
                      <p className="text-xs text-brand-grafite/60">
                        Serviço em {new Date(item.service.data).toLocaleDateString('pt-BR')} • Pet:{' '}
                        {item.service.animal?.nome ?? '—'}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Notas de pagamento</p>
              <textarea
                className="mt-2 w-full rounded-xl border border-brand-azul/40 bg-white/95 p-3 text-sm text-brand-grafite shadow-inner focus:border-brand-escuro focus:outline-none focus:ring-2 focus:ring-brand-escuro/30"
                rows={4}
                placeholder="Registre detalhes sobre como e quando o pagamento foi feito."
                value={paymentNotes}
                onChange={(event) => setPaymentNotes(event.target.value)}
                disabled={selectedInvoice.status.slug === 'QUITADA'}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default CashierPage;
