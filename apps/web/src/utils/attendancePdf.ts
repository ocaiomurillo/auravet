import type { Attendance, Appointment } from '../types/api';
import { buildOwnerAddress, formatCpf } from './owner';
import { applyPdfBrandFont, loadJsPdf, loadLogoDataUrl, type JsPDFInstance } from './pdf';

const attendanceTypeLabels: Record<Attendance['tipo'], string> = {
  CONSULTA: 'Consulta',
  EXAME: 'Exame',
  VACINACAO: 'Vacinação',
  CIRURGIA: 'Cirurgia',
  OUTROS: 'Outros cuidados',
};

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const brandColors = {
  primary: [61, 102, 85] as [number, number, number],
  text: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  subtle: [100, 116, 139] as [number, number, number],
};

const pageMargin = 18;
const contentLimit = 210 - pageMargin;
const contentWidth = contentLimit - pageMargin;

const addPdfSectionTitle = (doc: JsPDFInstance, title: string, y: number, fontName: string) => {
  doc.setFontSize(11);
  doc.setTextColor(...brandColors.text);
  doc.setFont(fontName, 'bold');
  doc.text(title, pageMargin, y);
  doc.setDrawColor(...brandColors.primary);
  doc.setLineWidth(0.6);
  doc.line(pageMargin, y + 2, contentLimit, y + 2);
  doc.setFont(fontName, 'normal');
};

const ensurePdfSpace = (doc: JsPDFInstance, currentY: number, extraSpace = 12, fontName?: string) => {
  if (currentY + extraSpace < 280) {
    return currentY;
  }

  doc.addPage();
  if (fontName) {
    doc.setFont(fontName, 'normal');
  }
  return 20;
};

const appendPdfKeyValue = (
  doc: JsPDFInstance,
  label: string,
  value: string,
  y: number,
  fontName: string,
  color: [number, number, number] = brandColors.text,
) => {
  doc.setFontSize(10);
  doc.setTextColor(...color);
  doc.setFont(fontName, 'normal');
  doc.text(`${label}: ${value}`, pageMargin, y);
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const buildAttendancePdf = async (service: Attendance, appointment?: Appointment | null) => {
  const JsPdf = await loadJsPdf();
  const doc: JsPDFInstance = new JsPdf();
  const logo = await loadLogoDataUrl();
  const fontName = await applyPdfBrandFont(doc);

  const owner = service.animal?.owner;
  const pet = service.animal;
  const scheduleStart = appointment?.scheduledStart ?? service.appointment?.scheduledStart ?? service.data;
  const scheduleEnd = appointment?.scheduledEnd ?? service.appointment?.scheduledEnd ?? service.data;
  const visitDate = new Date(service.data);
  const humanizedDate = visitDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const attendanceHeadline = `Atendimento de ${pet?.nome ?? 'pet'} em ${humanizedDate}`;

  let currentY = 20;

  if (logo) {
    doc.addImage(logo, 'PNG', pageMargin, currentY - 8, 26, 16);
  }

  doc.setTextColor(...brandColors.text);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(16);
  doc.text('Auravet', pageMargin + 32, currentY);
  doc.setFontSize(11);
  doc.setFont(fontName, 'normal');
  doc.setTextColor(...brandColors.muted);
  doc.text('Ficha de atendimento', pageMargin + 32, currentY + 8);

  doc.setDrawColor(...brandColors.primary);
  doc.setLineWidth(0.6);
  doc.line(pageMargin, currentY + 12, contentLimit, currentY + 12);

  currentY += 24;
  doc.setTextColor(...brandColors.text);
  doc.setFont(fontName, 'bold');
  doc.setFontSize(12);
  doc.text(attendanceHeadline, pageMargin, currentY);
  doc.setFont(fontName, 'normal');

  currentY += 8;
  doc.setFontSize(10);
  doc.setTextColor(...brandColors.muted);
  doc.text(`Tipo de atendimento: ${attendanceTypeLabels[service.tipo] ?? service.tipo}`, pageMargin, currentY);
  currentY += 6;
  doc.text(`Data do atendimento: ${visitDate.toLocaleString('pt-BR')}`, pageMargin, currentY);

  currentY += 12;
  addPdfSectionTitle(doc, 'Tutor', currentY, fontName);
  currentY += 8;
  appendPdfKeyValue(doc, 'Nome', owner?.nome ?? 'Não informado', currentY, fontName);
  currentY += 6;
  if (owner?.email) {
    appendPdfKeyValue(doc, 'E-mail', owner.email, currentY, fontName);
    currentY += 6;
  }
  if (owner?.telefone) {
    appendPdfKeyValue(doc, 'Telefone', owner.telefone, currentY, fontName);
    currentY += 6;
  }
  const ownerCpf = owner ? formatCpf(owner.cpf) : null;
  if (ownerCpf) {
    appendPdfKeyValue(doc, 'CPF', ownerCpf, currentY, fontName);
    currentY += 6;
  }
  const ownerAddress = owner ? buildOwnerAddress(owner) : '';
  if (ownerAddress) {
    appendPdfKeyValue(doc, 'Endereço', ownerAddress, currentY, fontName);
    currentY += 6;
  }

  currentY += 4;
  addPdfSectionTitle(doc, 'Pet', currentY, fontName);
  currentY += 8;
  appendPdfKeyValue(doc, 'Nome', pet?.nome ?? 'Não informado', currentY, fontName);
  currentY += 6;
  if (pet?.especie) {
    appendPdfKeyValue(doc, 'Espécie', pet.especie, currentY, fontName);
    currentY += 6;
  }
  if (pet?.raca) {
    appendPdfKeyValue(doc, 'Raça', pet.raca, currentY, fontName);
    currentY += 6;
  }

  currentY += 4;
  addPdfSectionTitle(doc, 'Horários do atendimento', currentY, fontName);
  currentY += 8;
  appendPdfKeyValue(doc, 'Início', scheduleStart ? formatDateTime(scheduleStart) : '—', currentY, fontName);
  currentY += 6;
  appendPdfKeyValue(doc, 'Término', scheduleEnd ? formatDateTime(scheduleEnd) : '—', currentY, fontName);

  currentY += 8;
  addPdfSectionTitle(doc, 'Serviços realizados', currentY, fontName);
  currentY += 8;

    if (service.catalogItems.length === 0) {
      appendPdfKeyValue(doc, 'Itens', 'Nenhum serviço cadastrado', currentY, fontName, brandColors.subtle);
      currentY += 10;
    }

  service.catalogItems.forEach((item, index) => {
    currentY = ensurePdfSpace(doc, currentY, 18, fontName);
    appendPdfKeyValue(doc, `${index + 1}. ${item.definition.nome}`, '', currentY, fontName);
    currentY += 6;
      appendPdfKeyValue(doc, 'Quantidade', String(item.quantidade), currentY, fontName, brandColors.muted);
      currentY += 6;
      appendPdfKeyValue(doc, 'Subtotal', formatCurrency(item.valorTotal), currentY, fontName, brandColors.muted);
    if (item.observacoes) {
      currentY += 6;
      const wrapped = doc.splitTextToSize(item.observacoes, contentWidth);
      doc.text(wrapped, pageMargin, currentY);
      currentY += wrapped.length * 6;
    }
    currentY += 4;
  });

  currentY = ensurePdfSpace(doc, currentY, 16, fontName);
  addPdfSectionTitle(doc, 'Produtos utilizados', currentY, fontName);
  currentY += 8;

    if (service.items.length === 0) {
      appendPdfKeyValue(doc, 'Itens', 'Nenhum produto aplicado', currentY, fontName, brandColors.subtle);
      currentY += 10;
    }

  service.items.forEach((item, index) => {
    currentY = ensurePdfSpace(doc, currentY, 18, fontName);
    appendPdfKeyValue(doc, `${index + 1}. ${item.product.nome}`, '', currentY, fontName);
    currentY += 6;
      appendPdfKeyValue(doc, 'Quantidade', String(item.quantidade), currentY, fontName, brandColors.muted);
      currentY += 6;
      appendPdfKeyValue(doc, 'Subtotal', formatCurrency(item.valorTotal), currentY, fontName, brandColors.muted);
    currentY += 4;
  });

  currentY = ensurePdfSpace(doc, currentY, 20, fontName);
  addPdfSectionTitle(doc, 'Totais do atendimento', currentY, fontName);
  currentY += 8;

  const servicesTotal = service.catalogItems.reduce((sum, item) => sum + item.valorTotal, 0);
  const productsTotal = service.items.reduce((sum, item) => sum + item.valorTotal, 0);
  const overallTotal = service.preco ?? servicesTotal + productsTotal;

  appendPdfKeyValue(doc, 'Serviços', formatCurrency(servicesTotal), currentY, fontName);
  currentY += 6;
  appendPdfKeyValue(doc, 'Produtos', formatCurrency(productsTotal), currentY, fontName);
  currentY += 6;
    appendPdfKeyValue(doc, 'Total geral', formatCurrency(overallTotal), currentY, fontName, brandColors.text);

  if (service.notes?.length) {
    currentY += 12;
    addPdfSectionTitle(doc, 'Prontuário do atendimento', currentY, fontName);
    currentY += 8;

    const sortedNotes = [...service.notes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    sortedNotes.forEach((note) => {
      const wrapped = doc.splitTextToSize(note.conteudo, contentWidth);
      const entryHeight = 6 + wrapped.length * 6 + 4;
      currentY = ensurePdfSpace(doc, currentY, entryHeight, fontName);

      const header = `Autor: ${note.author.nome} — ${formatDateTime(note.createdAt)}`;
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.setFont(fontName, 'bold');
      doc.text(header, pageMargin, currentY);
      currentY += 6;

      doc.setFont(fontName, 'normal');
      doc.setTextColor(...brandColors.text);
      doc.text(wrapped, pageMargin, currentY);
      currentY += wrapped.length * 6 + 4;
    });
  } else if (service.observacoes) {
    currentY += 12;
    addPdfSectionTitle(doc, 'Prontuário do atendimento', currentY, fontName);
    currentY += 8;

    const wrapped = doc.splitTextToSize(service.observacoes, contentWidth);
    currentY = ensurePdfSpace(doc, currentY, wrapped.length * 6 + 4, fontName);
    doc.setFont(fontName, 'normal');
    doc.setTextColor(...brandColors.text);
    doc.text(wrapped, pageMargin, currentY);
    currentY += wrapped.length * 6 + 4;
  }

  const fileDate = new Date(service.data).toISOString().split('T')[0];
  doc.save(`atendimento-${fileDate}-${service.animal?.nome ?? 'pet'}.pdf`);
};

