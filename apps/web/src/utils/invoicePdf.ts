import type { Invoice, PaymentConditionDetails, PaymentMethod } from '../types/api';
import { buildOwnerAddress, formatCpf } from './owner';
import { applyPdfBrandFont, loadJsPdf, loadLogoDataUrl, type JsPDFInstance } from './pdf';

const brandColors = {
  primary: [61, 102, 85] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  subtle: [100, 116, 139] as [number, number, number],
};

export const fallbackPaymentConditions: PaymentConditionDetails[] = [
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

const paymentMethodLabels: Record<PaymentMethod, string> = {
  DINHEIRO: 'Dinheiro',
  CARTAO_CREDITO: 'Cartão de crédito',
  CARTAO_DEBITO: 'Cartão de débito',
  PIX: 'Pix',
  BOLETO: 'Boleto',
  OUTROS: 'Outros',
};

export const paymentMethodLabel = (method: PaymentMethod | null | undefined) =>
  method ? paymentMethodLabels[method] ?? 'Não definido' : 'Não definido';

export const paymentConditionLabel = (
  conditionId: string | null | undefined,
  conditions: PaymentConditionDetails[],
) => {
  if (!conditionId) return 'Não definido';

  const condition = conditions.find((item) => item.id === conditionId);
  if (!condition) return 'Não definido';

  return condition.observacoes ? `${condition.nome} • ${condition.observacoes}` : condition.nome;
};

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
) => {
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
      dueDate: dueDate.toISOString().split('T')[0],
      paidAt: null,
    };
  });
};

export const resolveInvoiceInstallmentsForDisplay = (
  invoice: Invoice,
  conditions: PaymentConditionDetails[],
  fallbackCondition?: string,
) => {
  if (invoice.installments.length) {
    return [...invoice.installments].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
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

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export const buildInvoicePdf = async (invoice: Invoice, conditions: PaymentConditionDetails[]) => {
  const JsPdf = await loadJsPdf();
  const doc = new JsPdf();
  const fontName = await applyPdfBrandFont(doc);
  const logo = await loadLogoDataUrl();
  const paymentConditions = conditions.length ? conditions : fallbackPaymentConditions;
  const installmentsForPdf = resolveInvoiceInstallmentsForDisplay(
    invoice,
    paymentConditions,
    invoice.paymentConditionDetails?.id ?? invoice.paymentCondition ?? paymentConditions[0].id,
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
  const referenceSummary = referenceDate ? `Referente a atendimento em ${referenceDate.toLocaleDateString('pt-BR')}` : null;
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
    paymentConditionLabel(invoice.paymentConditionDetails?.id ?? invoice.paymentCondition, paymentConditions),
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
      installment.paidAt ? `Pago em ${new Date(installment.paidAt).toLocaleDateString('pt-BR')}` : 'Em aberto',
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
