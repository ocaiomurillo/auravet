import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import Button from '../components/Button';
import Card from '../components/Card';
import Field from '../components/Field';
import Modal from '../components/Modal';
import SelectField from '../components/SelectField';
import type {
  Invoice,
  InvoiceItem,
  InvoiceListResponse,
  OwnerSummary,
  PaymentConditionDetails,
  PaymentMethod,
  Product,
} from '../types/api';
import { apiClient, invoicesApi, paymentConditionsApi, productsApi } from '../lib/apiClient';
import { buildOwnerAddress, formatCpf } from '../utils/owner';
import { JsPDFInstance, applyPdfBrandFont, loadJsPdf, loadLogoDataUrl } from '../utils/pdf';

const brandColors = {
  primary: [61, 102, 85] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  subtle: [100, 116, 139] as [number, number, number],
};

const addSectionTitle = (doc: JsPDFInstance, title: string, y: number, fontName: string) => {
  doc.setFont(fontName, 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...brandColors.text);
  doc.text(title, 15, y);
  doc.setDrawColor(...brandColors.primary);
  doc.setLineWidth(0.6);
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
  color: [number, number, number] = brandColors.text,
  fontName?: string,
) => {
  if (fontName) {
    doc.setFont(fontName, 'normal');
  }
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.text(`${label}: ${value}`, 15, y);
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

type InstallmentFormState = {
  id: string;
  amount: string;
  dueDate: string;
  paidAt: string | null;
};

const paymentMethodOptions: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'OUTROS', label: 'Outros' },
];

const paymentMethodLabel = (method: PaymentMethod | null | undefined) =>
  paymentMethodOptions.find((option) => option.value === method)?.label ?? 'Não definido';

const fallbackPaymentConditions: PaymentConditionDetails[] = [
  { id: 'A_VISTA', nome: 'À vista', parcelas: 1, prazoDias: 0, observacoes: null, createdAt: '', updatedAt: '' },
  {
    id: 'DIAS_30',
    nome: '30 dias',
    parcelas: 1,
    prazoDias: 30,
    observacoes: 'Vencimento em 30 dias.',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'DIAS_60',
    nome: '60 dias',
    parcelas: 1,
    prazoDias: 60,
    observacoes: 'Vencimento em 60 dias.',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'CARTAO_2X',
    nome: '2x cartão',
    parcelas: 2,
    prazoDias: 30,
    observacoes: 'Parcelas a cada 30 dias.',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'CARTAO_3X',
    nome: '3x cartão',
    parcelas: 3,
    prazoDias: 30,
    observacoes: 'Parcelas a cada 30 dias.',
    createdAt: '',
    updatedAt: '',
  },
];

const paymentConditionLabel = (conditionId: string | null | undefined, conditions: PaymentConditionDetails[]) => {
  if (!conditionId) return 'Não definido';

  const condition = conditions.find((item) => item.id === conditionId);
  if (!condition) return 'Não definido';

  return condition.observacoes ? `${condition.nome} • ${condition.observacoes}` : condition.nome;
};

const normalizeDateInput = (value: string) => value.split('T')[0];

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const buildInstallmentSchedule = (
  conditionId: string,
  conditions: PaymentConditionDetails[],
  total: number,
  anchorDateIso: string,
): InstallmentFormState[] => {
  const condition = conditions.find((option) => option.id === conditionId) ?? conditions[0];
  const anchorDate = new Date(anchorDateIso);
  const baseAmount = Number((total / condition.parcelas).toFixed(2));
  let accumulated = 0;

  return Array.from({ length: condition.parcelas }).map((_, index) => {
    const isLast = index === condition.parcelas - 1;
    const amount = isLast ? Number((total - accumulated).toFixed(2)) : baseAmount;
    accumulated += amount;
    const dueDate = addDays(anchorDate, condition.prazoDias * index);

    return {
      id: `installment-${index}-${condition.id}-${anchorDate.getTime()}`,
      amount: amount.toFixed(2),
      dueDate: normalizeDateInput(dueDate.toISOString()),
      paidAt: null,
    };
  });
};

const resolveInvoiceInstallmentsForDisplay = (
  invoice: Invoice,
  conditions: PaymentConditionDetails[],
  fallbackCondition?: string,
) => {
  if (invoice.installments.length) {
    return [...invoice.installments].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
    );
  }

  const schedule = buildInstallmentSchedule(
    fallbackCondition ?? invoice.paymentConditionDetails?.id ?? invoice.paymentCondition ?? conditions[0].id,
    conditions,
    invoice.total,
    invoice.dueDate,
  );

  return schedule.map((installment, index) => ({
    id: installment.id ?? `${invoice.id}-installment-${index}`,
    amount: Number(installment.amount),
    dueDate: installment.dueDate,
    paidAt: installment.paidAt,
  }));
};

const buildInvoicePdf = async (invoice: Invoice, conditions: PaymentConditionDetails[]) => {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf();
  const fontName = await applyPdfBrandFont(doc);
  const logo = await loadLogoDataUrl();
  const installmentsForPdf = resolveInvoiceInstallmentsForDisplay(
    invoice,
    conditions.length ? conditions : fallbackPaymentConditions,
  );
  const dueDate = new Date(installmentsForPdf[0]?.dueDate ?? invoice.dueDate);
  const createdAt = new Date(invoice.createdAt);
  const paidInstallments = installmentsForPdf.filter((installment) => installment.paidAt);
  const nextPendingInstallment = installmentsForPdf.find((installment) => !installment.paidAt);
  const primaryPet = invoice.items.find((item) => item.service?.animal?.nome)?.service?.animal?.nome;
  const primaryServiceDate = invoice.items.find((item) => item.service?.data)?.service?.data;
  const referenceDate = primaryServiceDate ? new Date(primaryServiceDate) : null;
  const paymentCondition = invoice.paymentConditionDetails;
  const paymentConditionSummary = paymentCondition
    ? `${paymentCondition.parcelas} parcela(s) • ${paymentCondition.prazoDias} dia(s) para vencimento`
    : null;

  if (logo) {
    doc.addImage(logo, 'PNG', 15, 6, 32, 20);
  }

  doc.setFont(fontName, 'bold');
  doc.setTextColor(...brandColors.primary);
  doc.setFontSize(16);
  doc.text('Auravet', 52, 16);
  doc.setFont(fontName, 'normal');
  doc.setTextColor(...brandColors.muted);
  doc.setFontSize(11);
  doc.text('Detalhamento da cobrança', 52, 24);

  const invoiceHeadline = `Conta para ${invoice.owner.nome}${primaryPet ? ` • Pet ${primaryPet}` : ''}`;
  const billingSummary = `Vencimento: ${dueDate.toLocaleDateString('pt-BR')} • Emitida em: ${createdAt.toLocaleDateString('pt-BR')}`;
  const referenceSummary = referenceDate
    ? `Referente a atendimento em ${referenceDate.toLocaleDateString('pt-BR')}`
    : null;
  const statusLine = `Status: ${invoice.status.name} • ${paidInstallments.length}/${installmentsForPdf.length} parcelas pagas`;

  doc.setFont(fontName, 'bold');
  doc.setTextColor(...brandColors.text);
  doc.setFontSize(12);
  doc.text(invoiceHeadline, 15, 38);
  doc.setFont(fontName, 'normal');
  doc.setTextColor(...brandColors.muted);
  doc.setFontSize(10);
  doc.text(billingSummary, 15, 45);
  if (referenceSummary) {
    doc.text(referenceSummary, 15, 52);
  }
  doc.setFontSize(9);
  doc.setFont(fontName, 'bold');
  doc.setTextColor(...brandColors.primary);
  const statusPositionY = referenceSummary ? 60 : 52;
  doc.text(statusLine, 15, statusPositionY);

  let currentY = referenceSummary ? 70 : 62;
  doc.setDrawColor(...brandColors.subtle);
  doc.setLineWidth(0.2);
  doc.line(15, currentY, 195, currentY);
  currentY += 12;

  addSectionTitle(doc, 'Tutor', currentY, fontName);
  currentY += 8;
  appendKeyValue(doc, 'Nome', invoice.owner.nome, currentY, brandColors.text, fontName);
  currentY += 6;
  if (invoice.owner.email) {
    appendKeyValue(doc, 'E-mail', invoice.owner.email, currentY, brandColors.text, fontName);
    currentY += 6;
  }
  if (invoice.owner.telefone) {
    appendKeyValue(doc, 'Telefone', invoice.owner.telefone, currentY, brandColors.text, fontName);
    currentY += 6;
  }
  const ownerCpf = formatCpf(invoice.owner.cpf);
  if (ownerCpf) {
    appendKeyValue(doc, 'CPF', ownerCpf, currentY, brandColors.text, fontName);
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
  addSectionTitle(doc, 'Itens faturados', currentY, fontName);
  currentY += 8;
  doc.setFont(fontName, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brandColors.text);
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

    doc.setFont(fontName, 'normal');
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
      doc.setFont(fontName, 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(subInfo.join(' • '), 15, currentY + 4);
      currentY += 8;
    }
  });

  currentY = ensureSpace(doc, currentY, 16);
  addSectionTitle(doc, 'Totais', currentY, fontName);
  currentY += 10;
  const subtotal = invoice.items.reduce((acc, item) => acc + item.total, 0);
  appendKeyValue(doc, 'Subtotal', currencyFormatter.format(subtotal), currentY, brandColors.text, fontName);
  currentY += 6;
  appendKeyValue(doc, 'Total da fatura', currencyFormatter.format(invoice.total), currentY, brandColors.primary, fontName);
  currentY += 12;

  if (paymentCondition) {
    appendKeyValue(doc, 'Condição de pagamento', paymentCondition.nome, currentY, brandColors.text, fontName);
    currentY += 6;
    if (paymentConditionSummary) {
      appendKeyValue(doc, 'Condições', paymentConditionSummary, currentY, brandColors.muted, fontName);
      currentY += 6;
    }
    if (paymentCondition.observacoes) {
      const wrapped = doc.splitTextToSize(paymentCondition.observacoes, 175);
      appendKeyValue(doc, 'Observações', wrapped.shift() ?? '', currentY, brandColors.muted, fontName);
      if (wrapped.length > 0) {
        doc.text(wrapped, 30, currentY + 6);
        currentY += wrapped.length * 6;
      }
      currentY += 6;
    }
    currentY += 6;
  }

  currentY = ensureSpace(doc, currentY, 20);
  addSectionTitle(doc, 'Condições de pagamento', currentY, fontName);
  currentY += 8;
  appendKeyValue(doc, 'Forma', paymentMethodLabel(invoice.paymentMethod), currentY, brandColors.text, fontName);
  currentY += 6;
  appendKeyValue(
    doc,
    'Condição',
    paymentConditionLabel(
      invoice.paymentConditionDetails?.id ?? invoice.paymentCondition,
      conditions.length ? conditions : fallbackPaymentConditions,
    ),
    currentY,
    brandColors.text,
    fontName,
  );
  currentY += 10;

  addSectionTitle(doc, 'Parcelas', currentY, fontName);
  currentY += 8;
  doc.setFont(fontName, 'bold');
  doc.setTextColor(...brandColors.text);
  doc.text('#', 15, currentY);
  doc.text('Vencimento', 30, currentY);
  doc.text('Valor', 90, currentY, { align: 'right' as const });
  doc.text('Status', 190, currentY, { align: 'right' as const });
  currentY += 4;
  doc.setLineWidth(0.2);
  doc.line(15, currentY, 195, currentY);
  currentY += 6;

  installmentsForPdf.forEach((installment, index) => {
    currentY = ensureSpace(doc, currentY, 10);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(...brandColors.text);
    doc.text(String(index + 1), 15, currentY);
    doc.text(new Date(installment.dueDate).toLocaleDateString('pt-BR'), 30, currentY);
    doc.text(currencyFormatter.format(installment.amount), 90, currentY, { align: 'right' as const });
    doc.text(
      installment.paidAt
        ? `Pago em ${new Date(installment.paidAt).toLocaleDateString('pt-BR')}`
        : 'Em aberto',
      190,
      currentY,
      { align: 'right' as const },
    );
    currentY += 6;
  });

  currentY += 4;
  doc.setFont(fontName, 'normal');
  doc.setTextColor(...brandColors.muted);
  doc.text(
    nextPendingInstallment
      ? `Próximo vencimento em ${new Date(nextPendingInstallment.dueDate).toLocaleDateString('pt-BR')}`
      : 'Todas as parcelas estão quitadas.',
    15,
    currentY,
  );

  return doc;
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

type InvoiceFiltersState = {
  ownerId: string;
  status: string;
  from: string;
  to: string;
};

const CashierPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<InvoiceFiltersState>({ ownerId: '', status: '', from: '', to: '' });
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const selectedInvoiceOwnerCpf = selectedInvoice ? formatCpf(selectedInvoice.owner.cpf) : null;
  const selectedInvoiceOwnerAddress = selectedInvoice ? buildOwnerAddress(selectedInvoice.owner) : null;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('DINHEIRO');
  const [paymentConditionId, setPaymentConditionId] = useState('A_VISTA');
  const [installments, setInstallments] = useState<InstallmentFormState[]>([]);
  const [isExtraItemFormOpen, setIsExtraItemFormOpen] = useState(false);
  const [extraItemMode, setExtraItemMode] = useState<'product' | 'custom'>('product');
  const [extraItemProductId, setExtraItemProductId] = useState('');
  const [extraItemDescription, setExtraItemDescription] = useState('');
  const [extraItemQuantity, setExtraItemQuantity] = useState('1');
  const [extraItemUnitPrice, setExtraItemUnitPrice] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [removingItemId, setRemovingItemId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const adjustedInvoiceItemIdsRef = useRef<Set<string>>(new Set());

  const paymentConditionsQuery = useQuery<PaymentConditionDetails[]>({
    queryKey: ['payment-conditions'],
    queryFn: paymentConditionsApi.list,
  });

  const paymentConditions = useMemo(() => {
    const backendConditions = paymentConditionsQuery.data?.length
      ? paymentConditionsQuery.data
      : fallbackPaymentConditions;

    if (selectedInvoice?.paymentConditionDetails) {
      const hasCondition = backendConditions.some(
        (condition) => condition.id === selectedInvoice.paymentConditionDetails?.id,
      );

      if (!hasCondition) {
        return [...backendConditions, selectedInvoice.paymentConditionDetails];
      }
    }

    return backendConditions;
  }, [paymentConditionsQuery.data, selectedInvoice?.paymentConditionDetails]);

  const buildInstallmentsFromInvoice = useCallback(
    (invoice: Invoice, conditionOverride?: string) => {
      if (invoice.installments.length) {
        return invoice.installments.map((installment, index) => ({
          id: installment.id ?? `${invoice.id}-installment-${index}`,
          amount: installment.amount.toFixed(2),
          dueDate: normalizeDateInput(installment.dueDate),
          paidAt: installment.paidAt ? normalizeDateInput(installment.paidAt) : null,
        }));
      }

      const condition =
        conditionOverride ??
        invoice.paymentConditionDetails?.id ??
        invoice.paymentCondition ??
        paymentConditions[0]?.id ??
        'A_VISTA';
      return buildInstallmentSchedule(condition, paymentConditions, invoice.total, invoice.dueDate);
    },
    [paymentConditions],
  );

  const applyPaymentStateFromInvoice = useCallback(
    (invoice: Invoice) => {
      const conditionId =
        invoice.paymentConditionDetails?.id ?? invoice.paymentCondition ?? paymentConditions[0]?.id ?? 'A_VISTA';
      setPaymentMethod(invoice.paymentMethod ?? 'DINHEIRO');
      setPaymentConditionId(conditionId);
      setInstallments(buildInstallmentsFromInvoice(invoice, conditionId));
    },
    [buildInstallmentsFromInvoice, paymentConditions],
  );

  const updateInvoiceState = useCallback(
    (invoice: Invoice) => {
      setSelectedInvoice(invoice);
      applyPaymentStateFromInvoice(invoice);
    },
    [applyPaymentStateFromInvoice],
  );

  const resolveInvoiceInstallments = useCallback(
    (invoice: Invoice) => {
      if (invoice.installments.length) {
        return invoice.installments;
      }

      const schedule = buildInstallmentSchedule(
        invoice.paymentConditionDetails?.id ?? invoice.paymentCondition ?? paymentConditions[0].id,
        paymentConditions,
        invoice.total,
        invoice.dueDate,
      );

      return schedule.map((installment, index) => ({
        id: installment.id ?? `${invoice.id}-installment-${index}`,
        amount: Number(installment.amount),
        dueDate: installment.dueDate,
        paidAt: installment.paidAt,
      }));
    },
    [paymentConditions],
  );

  const summarizeInvoicePayments = useCallback(
    (invoice: Invoice) => {
      const installmentsList = [...resolveInvoiceInstallments(invoice)].sort(
        (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(),
      );

      const paidCount = installmentsList.filter((installment) => installment.paidAt).length;
      const nextDueDate = installmentsList.find((installment) => !installment.paidAt)?.dueDate ?? null;
      const isPaid = installmentsList.length ? paidCount === installmentsList.length : Boolean(invoice.paidAt);

      return { installmentsList, paidCount, nextDueDate, isPaid, totalInstallments: installmentsList.length };
    },
    [resolveInvoiceInstallments],
  );

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

  const productsQuery = useQuery<Product[]>({
    queryKey: ['sellable-products'],
    queryFn: () => productsApi.list(),
    enabled: Boolean(selectedInvoice),
  });

  const markPaidMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      paymentMethod: PaymentMethod;
      paymentConditionId: string;
      installments: { amount: number; dueDate: string; paidAt?: string }[];
    }) =>
      invoicesApi.markAsPaid(payload.id, {
        paymentMethod: payload.paymentMethod,
        paymentConditionId: payload.paymentConditionId,
        installments: payload.installments,
      }),
    onSuccess: async (invoice) => {
      toast.success('Pagamento registrado com sucesso.');
      await adjustStockForItems(invoice.items);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      updateInvoiceState(invoice);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível registrar o pagamento.');
    },
  });

  const adjustInvoiceMutation = useMutation({
    mutationFn: (payload: {
      id: string;
      dueDate: string;
      paymentMethod: PaymentMethod;
      paymentConditionId: string;
      installments: { amount: number; dueDate: string }[];
    }) =>
      invoicesApi.adjust(payload.id, {
        dueDate: payload.dueDate,
        paymentMethod: payload.paymentMethod,
        paymentConditionId: payload.paymentConditionId,
        installments: payload.installments,
      }),
    onSuccess: (invoice) => {
      toast.success('Fatura atualizada com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      updateInvoiceState(invoice);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Não foi possível atualizar a fatura.');
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
      updateInvoiceState(invoice);
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
      updateInvoiceState(invoice);
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

  const selectedInvoiceSummary = useMemo(
    () => (selectedInvoice ? summarizeInvoicePayments(selectedInvoice) : null),
    [selectedInvoice, summarizeInvoicePayments],
  );

  const installmentsTotal = useMemo(
    () => installments.reduce((acc, installment) => acc + Number(installment.amount || 0), 0),
    [installments],
  );

  const isSelectedInvoicePaid = selectedInvoiceSummary?.isPaid ?? false;

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

  useEffect(() => {
    if (selectedInvoice) {
      applyPaymentStateFromInvoice(selectedInvoice);
    } else {
      setPaymentMethod('DINHEIRO');
      setPaymentConditionId('A_VISTA');
      setInstallments([]);
    }

    setIsExtraItemFormOpen(false);
    setExtraItemMode('product');
    setExtraItemProductId('');
    setExtraItemDescription('');
    setExtraItemQuantity('1');
    setExtraItemUnitPrice('');
  }, [applyPaymentStateFromInvoice, selectedInvoice]);

  useEffect(() => {
    const alreadyAdjusted = new Set<string>();

    if (selectedInvoice) {
      const previousAdjustments = adjustedInvoiceItemIdsRef.current;
      const assumeAdjusted = isSelectedInvoicePaid;

      selectedInvoice.items.forEach((item) => {
        if (!item.productId) return;
        if (assumeAdjusted || item.service || previousAdjustments.has(item.id)) {
          alreadyAdjusted.add(item.id);
        }
      });
    }

    adjustedInvoiceItemIdsRef.current = alreadyAdjusted;
  }, [selectedInvoice, isSelectedInvoicePaid]);

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

  const handleExportXlsx = async () => {
    if (!invoices.length) {
      toast.error('Nenhuma conta encontrada para exportação.');
      return;
    }

    setIsExporting(true);

    try {
      const blob = await invoicesApi.exportFile(filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `auravet-contas-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Exportação em XLSX preparada.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Não foi possível exportar as contas.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleOpenInvoice = (invoice: Invoice) => {
    updateInvoiceState(invoice);
  };

  const handleCloseInvoice = () => {
    setSelectedInvoice(null);
    setInstallments([]);
  };

  const prepareInstallmentsForSubmission = (includePaidAt: boolean) => {
    if (!selectedInvoice) return null;

    if (!installments.length) {
      setInstallments(buildInstallmentsFromInvoice(selectedInvoice));
      toast.error('Configure as parcelas antes de registrar o pagamento.');
      return null;
    }

    const installmentsPayload = installments.map((installment) => ({
      amount: Number(installment.amount),
      dueDate: installment.dueDate,
      ...(includePaidAt ? { paidAt: installment.paidAt || undefined } : {}),
    }));

    const hasInvalidInstallment = installmentsPayload.some(
      (installment) => !installment.dueDate || Number.isNaN(installment.amount) || installment.amount <= 0,
    );

    if (hasInvalidInstallment) {
      toast.error('Revise valores e vencimentos das parcelas antes de salvar.');
      return null;
    }

    const totalFromInstallments = installmentsPayload.reduce((acc, installment) => acc + installment.amount, 0);
    if (Math.abs(totalFromInstallments - selectedInvoice.total) > 0.01) {
      toast.error('A soma das parcelas deve ser igual ao total da conta.');
      return null;
    }

    return installmentsPayload;
  };

  const handleMarkAsPaid = () => {
    if (!selectedInvoice) return;

    const installmentsPayload = prepareInstallmentsForSubmission(true);
    if (!installmentsPayload) return;

    markPaidMutation.mutate({
      id: selectedInvoice.id,
      paymentMethod,
      paymentConditionId,
      installments: installmentsPayload,
    });
  };

  const handleSaveInvoice = () => {
    if (!selectedInvoice) return;

    const installmentsPayload = prepareInstallmentsForSubmission(false);
    if (!installmentsPayload) return;

    const dueDate = installmentsPayload[0]?.dueDate ?? selectedInvoice.dueDate;

    adjustInvoiceMutation.mutate({
      id: selectedInvoice.id,
      dueDate,
      paymentMethod,
      paymentConditionId,
      installments: installmentsPayload.map((installment) => ({
        amount: installment.amount,
        dueDate: installment.dueDate,
      })),
    });
  };

  const handlePaymentConditionChange = (conditionId: string) => {
    setPaymentConditionId(conditionId);
    if (selectedInvoice) {
      setInstallments(buildInstallmentsFromInvoice(selectedInvoice, conditionId));
    }
  };

  const handleInstallmentFieldChange = (
    id: string,
    field: 'amount' | 'dueDate' | 'paidAt',
    value: string,
  ) => {
    setInstallments((prev) =>
      prev.map((installment) => (installment.id === id ? { ...installment, [field]: value } : installment)),
    );
  };

  const handleInstallmentPaidToggle = (id: string, checked: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    setInstallments((prev) =>
      prev.map((installment) =>
        installment.id === id ? { ...installment, paidAt: checked ? installment.paidAt ?? today : null } : installment,
      ),
    );
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

    if (isSelectedInvoicePaid) {
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
      const doc = await buildInvoicePdf(selectedInvoice, paymentConditions);
      const ownerSlug = slugify(selectedInvoice.owner.nome || 'tutor');
      const fileDate = new Date(selectedInvoice.dueDate).toISOString().split('T')[0];
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
                .map((invoice) => summarizeInvoicePayments(invoice).nextDueDate)
                .filter((dueDate): dueDate is string => Boolean(dueDate))
                .slice(0, 3)
                .map((dueDate) => new Date(dueDate).toLocaleDateString('pt-BR'))
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
            <Button
              type="button"
              variant="secondary"
              onClick={handleExportXlsx}
              disabled={isExporting}
            >
              {isExporting ? 'Gerando XLSX...' : 'Exportar XLSX'}
            </Button>
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
                  <th className="px-4 py-3">Pagamento</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-azul/10 bg-white/90">
                {invoices.map((invoice) => {
                  const ownerCpf = formatCpf(invoice.owner.cpf);
                  const ownerAddress = buildOwnerAddress(invoice.owner);
                  const paymentSummary = summarizeInvoicePayments(invoice);

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
                        <p className="font-semibold text-brand-escuro">{paymentMethodLabel(invoice.paymentMethod)}</p>
                        <p className="text-xs text-brand-grafite/60">
                          {paymentConditionLabel(
                            invoice.paymentConditionDetails?.id ?? invoice.paymentCondition,
                            paymentConditions,
                          )}
                        </p>
                        <p className="text-xs text-brand-grafite/60">
                          {paymentSummary.totalInstallments > 0
                            ? `${paymentSummary.paidCount}/${paymentSummary.totalInstallments} parcelas pagas`
                            : 'Pagamento à vista'}
                          {paymentSummary.nextDueDate
                            ? ` • Próx. ${new Date(paymentSummary.nextDueDate).toLocaleDateString('pt-BR')}`
                            : paymentSummary.isPaid
                              ? ' • Quitada'
                              : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            paymentSummary.isPaid
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {paymentSummary.isPaid ? 'Quitada' : 'Em aberto'}
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
        open={Boolean(selectedInvoice)}
        onClose={handleCloseInvoice}
        title="Detalhes da conta"
        description="Veja itens faturados, valores e registre o pagamento quando necessário."
        actions={
          <>
            <Button variant="ghost" onClick={handleCloseInvoice}>
              Fechar
            </Button>
            {!isSelectedInvoicePaid ? (
              <>
                <Button
                  variant="secondary"
                  onClick={handleSaveInvoice}
                  disabled={adjustInvoiceMutation.isPending || markPaidMutation.isPending}
                >
                  {adjustInvoiceMutation.isPending ? 'Salvando...' : 'Salvar fatura'}
                </Button>
                <Button
                  onClick={handleMarkAsPaid}
                  disabled={markPaidMutation.isPending || adjustInvoiceMutation.isPending}
                >
                  {markPaidMutation.isPending ? 'Registrando...' : 'Registrar pagamento'}
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {selectedInvoice ? (
          <div className="space-y-4 text-sm text-brand-grafite/80">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
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
                  <p className="font-semibold text-brand-escuro">
                    {selectedInvoiceSummary?.isPaid ? 'Quitada' : 'Em aberto'}
                  </p>
                  <p className="text-xs text-brand-grafite/60">{selectedInvoice.status.name}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Total</p>
                  <p className="font-semibold text-brand-escuro">
                    {currencyFormatter.format(selectedInvoice.total)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Parcelas</p>
                  <p className="font-semibold text-brand-escuro">
                    {selectedInvoiceSummary
                      ? `${selectedInvoiceSummary.paidCount}/${
                          selectedInvoiceSummary.totalInstallments || 1
                        } pagas`
                      : '—'}
                  </p>
                  <p className="text-xs text-brand-grafite/60">
                    {selectedInvoiceSummary?.nextDueDate
                      ? `Próximo vencimento em ${new Date(
                          selectedInvoiceSummary.nextDueDate,
                        ).toLocaleDateString('pt-BR')}`
                      : 'Sem parcelas pendentes'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Pagamento</p>
                  <p className="font-semibold text-brand-escuro">
                    {paymentMethodLabel(selectedInvoice.paymentMethod)}
                  </p>
                  <p className="text-xs text-brand-grafite/60">
                    {paymentConditionLabel(
                      selectedInvoice.paymentConditionDetails?.id ?? selectedInvoice.paymentCondition,
                      paymentConditions,
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Responsável</p>
                  <p>{selectedInvoice.responsible?.nome ?? 'Ainda não definido'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">
                    Condição de pagamento
                  </p>
                  <p className="font-semibold text-brand-escuro">
                    {selectedInvoice.paymentConditionDetails?.nome ?? 'Não definida'}
                  </p>
                  {selectedInvoice.paymentConditionDetails ? (
                    <p className="text-xs text-brand-grafite/60">
                      {selectedInvoice.paymentConditionDetails.parcelas} parcela(s) •{' '}
                      {selectedInvoice.paymentConditionDetails.prazoDias} dia(s) para vencimento
                    </p>
                  ) : null}
                  {selectedInvoice.paymentConditionDetails?.observacoes ? (
                    <p className="text-xs text-brand-grafite/60">
                      {selectedInvoice.paymentConditionDetails.observacoes}
                    </p>
                  ) : null}
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={handlePrintInvoice}
                disabled={isGeneratingPdf}
                className="self-start"
              >
                {isGeneratingPdf ? 'Gerando PDF...' : 'Baixar PDF da fatura'}
              </Button>
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
                      {!isSelectedInvoicePaid && !item.servicoId ? (
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

              {!isSelectedInvoicePaid ? (
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

            <div className="rounded-2xl border border-brand-azul/20 bg-white/95 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-grafite/60">Pagamento</p>
                  <p className="text-sm text-brand-grafite/70">
                    Defina a forma de pagamento e ajuste os vencimentos das parcelas desta conta.
                  </p>
                </div>
                <p className="text-xs font-semibold text-brand-escuro">
                  Total das parcelas: {currencyFormatter.format(installmentsTotal)}
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <SelectField
                  label="Forma de pagamento"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}
                  disabled={isSelectedInvoicePaid}
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </SelectField>

                <SelectField
                  label="Condição"
                  value={paymentConditionId}
                  onChange={(event) => handlePaymentConditionChange(event.target.value)}
                  disabled={isSelectedInvoicePaid}
                >
                  {paymentConditions.map((condition) => (
                    <option key={condition.id} value={condition.id}>
                      {condition.nome} ({condition.parcelas}x • {condition.prazoDias} dias)
                      {condition.observacoes ? ` • ${condition.observacoes}` : ''}
                    </option>
                  ))}
                </SelectField>
              </div>

              <div className="mt-4 space-y-3">
                {installments.map((installment, index) => (
                  <div
                    key={installment.id}
                    className="rounded-xl border border-brand-azul/20 bg-brand-azul/5 p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-semibold text-brand-escuro">Parcela {index + 1}</p>
                      <label className="flex items-center gap-2 text-xs font-semibold text-brand-escuro">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-brand-azul/60 text-brand-escuro focus:ring-brand-escuro/40"
                          checked={Boolean(installment.paidAt)}
                          onChange={(event) => handleInstallmentPaidToggle(installment.id, event.target.checked)}
                          disabled={isSelectedInvoicePaid}
                        />
                        Pago
                      </label>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Field
                        label="Valor (R$)"
                        type="number"
                        min={0}
                        step="0.01"
                        value={installment.amount}
                        onChange={(event) =>
                          handleInstallmentFieldChange(installment.id, 'amount', event.target.value)
                        }
                        disabled={isSelectedInvoicePaid}
                      />
                      <Field
                        label="Vencimento"
                        type="date"
                        value={installment.dueDate}
                        onChange={(event) =>
                          handleInstallmentFieldChange(installment.id, 'dueDate', event.target.value)
                        }
                        disabled={isSelectedInvoicePaid}
                      />
                      <Field
                        label="Pago em"
                        type="date"
                        value={installment.paidAt ?? ''}
                        onChange={(event) =>
                          handleInstallmentFieldChange(installment.id, 'paidAt', event.target.value)
                        }
                        disabled={isSelectedInvoicePaid || !installment.paidAt}
                      />
                    </div>
                  </div>
                ))}

                {installments.length === 0 ? (
                  <p className="text-xs text-brand-grafite/60">Nenhuma parcela configurada para esta conta.</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default CashierPage;
