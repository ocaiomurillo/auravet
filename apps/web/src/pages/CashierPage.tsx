import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import type {
  Appointment,
  AttendanceType,
  Invoice,
  InvoiceItem,
  InvoiceListResponse,
  OwnerSummary,
  Product,
} from '../types/api';
import { apiClient, appointmentsApi, invoicesApi, productsApi } from '../lib/apiClient';
import { buildOwnerAddress, formatCpf } from '../utils/owner';
import { JsPDFInstance, loadJsPdf, loadLogoDataUrl } from '../utils/pdf';

const addSectionTitle = (doc: JsPDFInstance, title: string, y: number) => {
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 15, y);
  doc.setLineWidth(0.4);
  doc.line(15, y + 2, 195, y + 2);
};

const ensureSpace = (doc: JsPDFInstance, currentY: number, extraSpace = 12) => {
  if (currentY + extraSpace < 280) {
    return currentY;
  }

  doc.addPage();
  return 20;
};

const appendKeyValue = (
  doc: JsPDFInstance,
  label: string,
  value: string,
  y: number,
  color: [number, number, number] = [30, 41, 59],
) => {
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(`${label}: ${value}`, 15, y);
};

const buildInvoicePdf = async (invoice: Invoice) => {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf();
  const logo = await loadLogoDataUrl();

  let currentY = 22;

  if (logo) {
    doc.addImage(logo, 'PNG', 15, 10, 32, 16);
  }

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Auravet', 52, 20);
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text('Fatura detalhada', 52, 28);

  currentY = 34;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Fatura nº ${invoice.id}`, 15, currentY);
  currentY += 6;
  doc.text(`Emitida em: ${new Date(invoice.createdAt).toLocaleDateString('pt-BR')}`, 15, currentY);
  currentY += 6;
  doc.text(`Vencimento: ${new Date(invoice.dueDate).toLocaleDateString('pt-BR')}`, 15, currentY);
  currentY += 6;
  doc.text(`Status: ${invoice.status.name}`, 15, currentY);

  currentY += 12;
  addSectionTitle(doc, 'Tutor', currentY);
  currentY += 8;
  appendKeyValue(doc, 'Nome', invoice.owner.nome, currentY);
  currentY += 6;
  if (invoice.owner.email) {
    appendKeyValue(doc, 'E-mail', invoice.owner.email, currentY);
    currentY += 6;
  }
  if (invoice.owner.telefone) {
    appendKeyValue(doc, 'Telefone', invoice.owner.telefone, currentY);
    currentY += 6;
  }
  const ownerCpf = formatCpf(invoice.owner.cpf);
  if (ownerCpf) {
    appendKeyValue(doc, 'CPF', ownerCpf, currentY);
    currentY += 6;
  }
  const ownerAddress = buildOwnerAddress(invoice.owner);
  if (ownerAddress) {
    const wrappedAddress = doc.splitTextToSize(ownerAddress, 175);
    doc.text(`Endereço: ${wrappedAddress.shift() ?? ''}`, 15, currentY);
    if (wrappedAddress.length > 0) {
      doc.text(wrappedAddress, 30, currentY + 6);
      currentY += wrappedAddress.length * 6;
    }
    currentY += 6;
  }

  currentY += 4;
  addSectionTitle(doc, 'Itens faturados', currentY);
  currentY += 8;
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Descrição', 15, currentY);
  doc.text('Qtd.', 120, currentY, { align: 'right' as const });
  doc.text('Unitário', 150, currentY, { align: 'right' as const });
  doc.text('Total', 190, currentY, { align: 'right' as const });
  currentY += 4;
  doc.setLineWidth(0.2);
  doc.line(15, currentY, 195, currentY);
  currentY += 6;

  invoice.items.forEach((item) => {
    currentY = ensureSpace(doc, currentY, 18);
    const descriptionLines = doc.splitTextToSize(item.description, 90);

    doc.setTextColor(30, 41, 59);
    doc.text(descriptionLines, 15, currentY);
    doc.text(String(item.quantity), 120, currentY, { align: 'right' as const });
    doc.text(currencyFormatter.format(item.unitPrice), 150, currentY, { align: 'right' as const });
    doc.text(currencyFormatter.format(item.total), 190, currentY, { align: 'right' as const });

    currentY += descriptionLines.length * 6;

    const subInfo: string[] = [];
    if (item.service?.data) {
      subInfo.push(`Serviço em ${new Date(item.service.data).toLocaleDateString('pt-BR')}`);
    }
    if (item.service?.animal?.nome) {
      subInfo.push(`Pet: ${item.service.animal.nome}`);
    }
    if (!item.servicoId && item.product?.nome) {
      subInfo.push(`Produto: ${item.product.nome}`);
    }
    if (!item.servicoId) {
      subInfo.push('Item extra');
    }

    if (subInfo.length > 0) {
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(subInfo.join(' • '), 15, currentY + 4);
      currentY += 8;
    }
  });

  currentY = ensureSpace(doc, currentY, 16);
  addSectionTitle(doc, 'Totais', currentY);
  currentY += 10;
  const subtotal = invoice.items.reduce((acc, item) => acc + item.total, 0);
  appendKeyValue(doc, 'Subtotal', currencyFormatter.format(subtotal), currentY);
  currentY += 6;
  appendKeyValue(doc, 'Total da fatura', currencyFormatter.format(invoice.total), currentY, [22, 101, 52]);
  currentY += 12;

  currentY = ensureSpace(doc, currentY, 20);
  addSectionTitle(doc, 'Notas de pagamento', currentY);
  currentY += 8;
  const notes = invoice.paymentNotes?.trim() || 'Nenhuma observação registrada.';
  const wrappedNotes = doc.splitTextToSize(notes, 175);
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(wrappedNotes, 15, currentY);

  return doc;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const attendanceTypeLabels: Record<AttendanceType, string> = {
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
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const selectedInvoiceOwnerCpf = selectedInvoice ? formatCpf(selectedInvoice.owner.cpf) : null;
  const selectedInvoiceOwnerAddress = selectedInvoice ? buildOwnerAddress(selectedInvoice.owner) : null;
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isExtraItemFormOpen, setIsExtraItemFormOpen] = useState(false);
  const [extraItemMode, setExtraItemMode] = useState<'product' | 'custom'>('product');
  const [extraItemProductId, setExtraItemProductId] = useState('');
  const [extraItemDescription, setExtraItemDescription] = useState('');
  const [extraItemQuantity, setExtraItemQuantity] = useState('1');
  const [extraItemUnitPrice, setExtraItemUnitPrice] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const adjustedInvoiceItemIdsRef = useRef<Set<string>>(new Set());

  const { data: owners } = useQuery({
    queryKey: ['owners', 'basic'],
    queryFn: () => apiClient.get<OwnerSummary[]>('/owners/basic'),
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

  const billableAppointmentsQuery = useQuery<Appointment[]>({
    queryKey: ['billable-appointments', ownerForModal],
    queryFn: () => appointmentsApi.billable(ownerForModal || undefined),
    enabled: isGenerateModalOpen,
  });

  const productsQuery = useQuery<Product[]>({
    queryKey: ['sellable-products'],
    queryFn: () => productsApi.list(),
    enabled: Boolean(selectedInvoice),
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { appointmentId: string; dueDate?: string }) =>
      invoicesApi.generateFromAppointment(payload),
    onSuccess: (invoice) => {
      toast.success('Conta emitida com carinho.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['billable-appointments'] });
      setIsGenerateModalOpen(false);
      setSelectedAppointmentId('');
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
    onSuccess: async (invoice) => {
      toast.success('Pagamento registrado com sucesso.');
      await adjustStockForItems(invoice.items);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoice(invoice);
      setPaymentNotes(invoice.paymentNotes ?? '');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.');
    },
  });

  const addManualItemMutation = useMutation({
    mutationFn: (params: {
      invoiceId: string;
      payload: { description: string; quantity: number; unitPrice: number; productId?: string };
    }) => invoicesApi.addManualItem(params.invoiceId, params.payload),
    onSuccess: async (invoice) => {
      toast.success('Item extra adicionado à conta.');
      await adjustStockForItems(invoice.items);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
      setSelectedInvoice(invoice);
      setPaymentNotes(invoice.paymentNotes ?? '');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível adicionar o item extra.');
    },
  });

  const removeManualItemMutation = useMutation({
    mutationFn: (params: { invoiceId: string; itemId: string }) =>
      invoicesApi.removeManualItem(params.invoiceId, params.itemId),
    onMutate: (params) => {
      setRemovingItemId(params.itemId);
    },
    onSuccess: (invoice) => {
      toast.success('Item removido da conta.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
      setSelectedInvoice(invoice);
      setPaymentNotes(invoice.paymentNotes ?? '');
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível remover o item.');
    },
    onSettled: () => {
      setRemovingItemId(null);
    },
  });

  const invoices = invoicesResponse?.invoices ?? [];
  const summary = invoicesResponse?.summary;

  const availableProducts = useMemo(
    () => (productsQuery.data ?? []).filter((product) => product.isSellable && product.isActive),
    [productsQuery.data],
  );

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    (productsQuery.data ?? []).forEach((product) => map.set(product.id, product));
    return map;
  }, [productsQuery.data]);

  const extraItemTotal = useMemo(() => {
    const quantity = Number(extraItemQuantity);
    const unitPrice = Number(extraItemUnitPrice);
    if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice)) {
      return 0;
    }
    return quantity > 0 && unitPrice >= 0 ? quantity * unitPrice : 0;
  }, [extraItemQuantity, extraItemUnitPrice]);

  const adjustStockForItems = async (items: InvoiceItem[]) => {
    const adjustments: InvoiceItem[] = [];

    items.forEach((item) => {
      if (!item.productId) return;
      if (adjustedInvoiceItemIdsRef.current.has(item.id)) return;

      const product = productMap.get(item.productId);
      if (!product || !product.isSellable) return;

      if (item.quantity > product.estoqueAtual) {
        toast.error(`Estoque insuficiente para ${product.nome}. Disponível: ${product.estoqueAtual}.`);
        return;
      }

      adjustments.push(item);
    });

    if (!adjustments.length) return;

    try {
      await Promise.all(
        adjustments.map((item) => productsApi.adjustStock(item.productId!, { amount: -item.quantity })),
      );

      adjustments.forEach((item) => adjustedInvoiceItemIdsRef.current.add(item.id));
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sellable-products'] });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Não foi possível atualizar o estoque dos produtos vendidos.',
      );
    }
  };

  const selectedAppointment = billableAppointmentsQuery.data?.find(
    (appointment) => appointment.id === selectedAppointmentId,
  );

  useEffect(() => {
    if (selectedAppointment) {
      const baseDateString = selectedAppointment.service?.data ?? selectedAppointment.scheduledStart;

      if (baseDateString) {
        const baseDate = new Date(baseDateString);
        baseDate.setDate(baseDate.getDate() + 7);
        setDueDate(baseDate.toISOString().slice(0, 10));
        return;
      }
    }

    setDueDate('');
  }, [selectedAppointment]);

  useEffect(() => {
    if (!isGenerateModalOpen) {
      setSelectedAppointmentId('');
      setOwnerForModal('');
      setDueDate('');
    }
  }, [isGenerateModalOpen]);

  useEffect(() => {
    setSelectedAppointmentId('');
  }, [ownerForModal]);

  useEffect(() => {
    if (selectedInvoice) {
      setPaymentNotes(selectedInvoice.paymentNotes ?? '');
    } else {
      setPaymentNotes('');
    }

    setIsExtraItemFormOpen(false);
    setExtraItemMode('product');
    setExtraItemProductId('');
    setExtraItemDescription('');
    setExtraItemQuantity('1');
    setExtraItemUnitPrice('');
  }, [selectedInvoice]);

  useEffect(() => {
    const alreadyAdjusted = new Set<string>();

    if (selectedInvoice) {
      const previousAdjustments = adjustedInvoiceItemIdsRef.current;
      const assumeAdjusted = selectedInvoice.status.slug === 'QUITADA';

      selectedInvoice.items.forEach((item) => {
        if (!item.productId) return;
        if (assumeAdjusted || item.service || previousAdjustments.has(item.id)) {
          alreadyAdjusted.add(item.id);
        }
      });
    }

    adjustedInvoiceItemIdsRef.current = alreadyAdjusted;
  }, [selectedInvoice]);

  useEffect(() => {
    if (extraItemMode !== 'product') {
      return;
    }

    const selectedProduct = availableProducts.find((product) => product.id === extraItemProductId);
    if (selectedProduct) {
      setExtraItemUnitPrice(selectedProduct.precoVenda.toFixed(2));
      setExtraItemDescription((current) => {
        if (!current || current.startsWith('Produto avulso:')) {
          return `Produto avulso: ${selectedProduct.nome}`;
        }
        return current;
      });
    } else {
      setExtraItemUnitPrice('');
    }
  }, [availableProducts, extraItemMode, extraItemProductId]);

  const handleFiltersSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    refetch();
  };

  const handleFiltersReset = () => {
    setFilters({ ownerId: '', status: '', from: '', to: '' });
  };

  const handleGenerateInvoice = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedAppointmentId) {
      toast.error('Selecione um atendimento para gerar a conta.');
      return;
    }

    generateMutation.mutate({
      appointmentId: selectedAppointmentId,
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

  const handleExtraItemModeChange = (mode: 'product' | 'custom') => {
    setExtraItemMode(mode);
    if (mode === 'product') {
      setExtraItemDescription('');
    } else {
      setExtraItemProductId('');
      setExtraItemDescription('');
      setExtraItemUnitPrice('');
    }
  };

  const handleAddExtraItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedInvoice) return;

    if (selectedInvoice.status.slug === 'QUITADA') {
      toast.error('Esta conta já foi quitada e não aceita novos itens.');
      return;
    }

    const quantity = Number(extraItemQuantity);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      toast.error('Informe uma quantidade válida para o item extra.');
      return;
    }

    const unitPrice = Number(extraItemUnitPrice);
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      toast.error('Informe um valor unitário válido.');
      return;
    }

    const description = extraItemDescription.trim();
    if (!description) {
      toast.error('Descreva o item que será adicionado à conta.');
      return;
    }

    const payload: { description: string; quantity: number; unitPrice: number; productId?: string } = {
      description,
      quantity,
      unitPrice,
    };

    if (extraItemMode === 'product') {
      if (!extraItemProductId) {
        toast.error('Selecione um produto para adicionar.');
        return;
      }

      const selectedProduct = productsQuery.data?.find((product) => product.id === extraItemProductId);

      if (!selectedProduct) {
        toast.error('Produto não encontrado. Atualize a lista e tente novamente.');
        return;
      }

      if (!selectedProduct.isSellable) {
        toast.error('Este produto é de uso interno e não pode ser vendido.');
        return;
      }

      if (quantity > selectedProduct.estoqueAtual) {
        toast.error(
          `Estoque insuficiente para ${selectedProduct.nome}. Disponível: ${selectedProduct.estoqueAtual}.`,
        );
        return;
      }

      payload.productId = extraItemProductId;
    }

    try {
      await addManualItemMutation.mutateAsync({ invoiceId: selectedInvoice.id, payload });
      setExtraItemQuantity('1');
      if (extraItemMode === 'custom') {
        setExtraItemDescription('');
        setExtraItemUnitPrice('');
      }
    } catch (err) {
      void err;
    }
  };

  const handleRemoveManualItem = (itemId: string) => {
    if (!selectedInvoice) return;
    removeManualItemMutation.mutate({ invoiceId: selectedInvoice.id, itemId });
  };

  const handlePrintInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      setIsGeneratingPdf(true);
      const doc = await buildInvoicePdf(selectedInvoice);
      const fileName = `auravet-fatura-${selectedInvoice.id}.pdf`;
      const blobUrl = doc.output('bloburl');

      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      doc.save(fileName);
      toast.success('PDF da fatura gerado. Você pode visualizar ou imprimir.');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Não foi possível gerar o PDF desta conta.',
      );
    } finally {
      setIsGeneratingPdf(false);
    }
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
        description="Selecione o atendimento concluído e personalize o vencimento da conta."
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
            label="Atendimento"
            value={selectedAppointmentId}
            onChange={(event) => setSelectedAppointmentId(event.target.value)}
          >
            <option value="">Selecione o atendimento já realizado</option>
            {billableAppointmentsQuery.data?.map((appointment) => {
              const referenceDate = appointment.service?.data ?? appointment.scheduledStart;

              return (
                <option key={appointment.id} value={appointment.id}>
                  {attendanceTypeLabels[appointment.tipo] ?? appointment.tipo} — {appointment.animal?.nome ?? 'Pet'} •{' '}
                  {referenceDate ? new Date(referenceDate).toLocaleDateString('pt-BR') : 'Data não informada'}
                </option>
              );
            })}
          </SelectField>
          {billableAppointmentsQuery.isLoading ? (
            <p className="text-xs text-brand-grafite/60">Buscando atendimentos disponíveis...</p>
          ) : null}
          {!billableAppointmentsQuery.isLoading && billableAppointmentsQuery.data?.length === 0 ? (
            <p className="text-xs text-brand-grafite/60">
              Nenhum atendimento elegível encontrado para os filtros atuais.
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
          <>
            <Button variant="ghost" onClick={handleCloseInvoice}>
              Fechar
            </Button>
            <Button variant="ghost" onClick={handlePrintInvoice} disabled={isGeneratingPdf}>
              {isGeneratingPdf ? 'Gerando PDF...' : 'Imprimir fatura'}
            </Button>
            {selectedInvoice?.status.slug !== 'QUITADA' ? (
              <Button onClick={handleMarkAsPaid} disabled={markPaidMutation.isPending}>
                {markPaidMutation.isPending ? 'Registrando...' : 'Registrar pagamento'}
              </Button>
            ) : null}
          </>
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
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
                        {!item.servicoId && item.product ? (
                          <p className="text-xs text-brand-grafite/60">Produto em estoque: {item.product.nome}</p>
                        ) : null}
                        {!item.servicoId ? (
                          <span className="inline-flex rounded-full bg-brand-azul/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-escuro/70">
                            Item extra
                          </span>
                        ) : null}
                      </div>
                      {selectedInvoice.status.slug !== 'QUITADA' && !item.servicoId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          className="rounded-lg bg-red-50 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                          onClick={() => handleRemoveManualItem(item.id)}
                          disabled={
                            removeManualItemMutation.isPending && removingItemId === item.id
                          }
                        >
                          {removeManualItemMutation.isPending && removingItemId === item.id
                            ? 'Removendo...'
                            : 'Remover'}
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {selectedInvoice.status.slug !== 'QUITADA' ? (
                <div className="mt-4 rounded-2xl border border-dashed border-brand-azul/40 bg-white/95 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-brand-escuro">Itens extras</p>
                      <p className="text-xs text-brand-grafite/60">
                        Registre produtos vendidos no balcão ou cobranças avulsas para esta conta.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-4 py-2 text-xs"
                      onClick={() => setIsExtraItemFormOpen((prev) => !prev)}
                    >
                      {isExtraItemFormOpen ? 'Ocultar formulário' : 'Adicionar item'}
                    </Button>
                  </div>

                  {isExtraItemFormOpen ? (
                    <form className="mt-4 space-y-4" onSubmit={handleAddExtraItem}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={clsx(
                            'rounded-full px-4 py-2 text-xs font-semibold transition',
                            extraItemMode === 'product'
                              ? 'bg-brand-escuro text-white shadow-md shadow-brand-escuro/30'
                              : 'bg-brand-azul/20 text-brand-escuro hover:bg-brand-azul/30',
                          )}
                          onClick={() => handleExtraItemModeChange('product')}
                        >
                          Produto em estoque
                        </button>
                        <button
                          type="button"
                          className={clsx(
                            'rounded-full px-4 py-2 text-xs font-semibold transition',
                            extraItemMode === 'custom'
                              ? 'bg-brand-escuro text-white shadow-md shadow-brand-escuro/30'
                              : 'bg-brand-azul/20 text-brand-escuro hover:bg-brand-azul/30',
                          )}
                          onClick={() => handleExtraItemModeChange('custom')}
                        >
                          Descrição livre
                        </button>
                      </div>

                      {extraItemMode === 'product' ? (
                        <div className="space-y-2">
                          <SelectField
                            label="Produto"
                            value={extraItemProductId}
                            onChange={(event) => setExtraItemProductId(event.target.value)}
                          >
                            <option value="">Selecione o produto em estoque</option>
                            {availableProducts.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.nome} — {currencyFormatter.format(product.precoVenda)} • Estoque:{' '}
                                {product.estoqueAtual}
                              </option>
                            ))}
                          </SelectField>
                          {productsQuery.isLoading ? (
                            <p className="text-xs text-brand-grafite/60">Carregando produtos vendáveis...</p>
                          ) : null}
                          {!productsQuery.isLoading && availableProducts.length === 0 ? (
                            <p className="text-xs text-brand-grafite/60">
                              Nenhum produto vendável disponível no momento.
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      <Field
                        label="Descrição"
                        value={extraItemDescription}
                        onChange={(event) => setExtraItemDescription(event.target.value)}
                        placeholder={
                          extraItemMode === 'product'
                            ? 'Ex.: Produto avulso: Coleira antipulgas'
                            : 'Descreva o item ou atendimento cobrado'
                        }
                      />

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field
                          label="Quantidade"
                          type="number"
                          min={1}
                          value={extraItemQuantity}
                          onChange={(event) => setExtraItemQuantity(event.target.value)}
                        />
                        <Field
                          label="Valor unitário (R$)"
                          type="number"
                          min={0}
                          step="0.01"
                          value={extraItemUnitPrice}
                          onChange={(event) => setExtraItemUnitPrice(event.target.value)}
                        />
                      </div>

                      <p className="text-xs text-brand-grafite/60">
                        Total estimado: {currencyFormatter.format(extraItemTotal)}
                      </p>

                      <div className="flex justify-end">
                        <Button type="submit" disabled={addManualItemMutation.isPending}>
                          {addManualItemMutation.isPending ? 'Adicionando...' : 'Adicionar item à conta'}
                        </Button>
                      </div>
                    </form>
                  ) : null}
                </div>
              ) : null}
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
