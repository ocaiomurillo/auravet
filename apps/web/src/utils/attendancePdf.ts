import type { Attendance, Appointment } from '../types/api';
import { buildOwnerAddress, formatCpf } from './owner';
import { loadJsPdf, loadLogoDataUrl, type JsPDFInstance } from './pdf';

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

const addPdfSectionTitle = (doc: JsPDFInstance, title: string, y: number) => {
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 15, y);
  doc.setLineWidth(0.4);
  doc.line(15, y + 2, 195, y + 2);
};

const ensurePdfSpace = (doc: JsPDFInstance, currentY: number, extraSpace = 12) => {
  if (currentY + extraSpace < 280) {
    return currentY;
  }

  doc.addPage();
  return 20;
};

const appendPdfKeyValue = (
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

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const buildAttendancePdf = async (service: Attendance, appointment?: Appointment | null) => {
  const JsPdf = await loadJsPdf();
  const doc: JsPDFInstance = new JsPdf();
  const logo = await loadLogoDataUrl();

  const owner = service.animal?.owner;
  const pet = service.animal;
  const scheduleStart = appointment?.scheduledStart ?? service.appointment?.scheduledStart ?? service.data;
  const scheduleEnd = appointment?.scheduledEnd ?? service.appointment?.scheduledEnd ?? service.data;

  let currentY = 22;

  if (logo) {
    doc.addImage(logo, 'PNG', 15, 10, 32, 16);
  }

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text('Auravet', 52, 20);
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text('Ficha de atendimento', 52, 28);

  currentY = 34;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(`Atendimento nº ${service.id}`, 15, currentY);
  currentY += 6;
  doc.text(`Tipo: ${attendanceTypeLabels[service.tipo] ?? service.tipo}`, 15, currentY);
  currentY += 6;
  doc.text(`Data do atendimento: ${new Date(service.data).toLocaleString('pt-BR')}`, 15, currentY);

  currentY += 12;
  addPdfSectionTitle(doc, 'Tutor', currentY);
  currentY += 8;
  appendPdfKeyValue(doc, 'Nome', owner?.nome ?? 'Não informado', currentY);
  currentY += 6;
  if (owner?.email) {
    appendPdfKeyValue(doc, 'E-mail', owner.email, currentY);
    currentY += 6;
  }
  if (owner?.telefone) {
    appendPdfKeyValue(doc, 'Telefone', owner.telefone, currentY);
    currentY += 6;
  }
  const ownerCpf = owner ? formatCpf(owner.cpf) : null;
  if (ownerCpf) {
    appendPdfKeyValue(doc, 'CPF', ownerCpf, currentY);
    currentY += 6;
  }
  const ownerAddress = owner ? buildOwnerAddress(owner) : '';
  if (ownerAddress) {
    appendPdfKeyValue(doc, 'Endereço', ownerAddress, currentY);
    currentY += 6;
  }

  currentY += 4;
  addPdfSectionTitle(doc, 'Pet', currentY);
  currentY += 8;
  appendPdfKeyValue(doc, 'Nome', pet?.nome ?? 'Não informado', currentY);
  currentY += 6;
  if (pet?.especie) {
    appendPdfKeyValue(doc, 'Espécie', pet.especie, currentY);
    currentY += 6;
  }
  if (pet?.raca) {
    appendPdfKeyValue(doc, 'Raça', pet.raca, currentY);
    currentY += 6;
  }

  currentY += 4;
  addPdfSectionTitle(doc, 'Horários do atendimento', currentY);
  currentY += 8;
  appendPdfKeyValue(doc, 'Início', scheduleStart ? formatDateTime(scheduleStart) : '—', currentY);
  currentY += 6;
  appendPdfKeyValue(doc, 'Término', scheduleEnd ? formatDateTime(scheduleEnd) : '—', currentY);

  currentY += 8;
  addPdfSectionTitle(doc, 'Serviços realizados', currentY);
  currentY += 8;

  if (service.catalogItems.length === 0) {
    appendPdfKeyValue(doc, 'Itens', 'Nenhum serviço cadastrado', currentY, [100, 116, 139]);
    currentY += 10;
  }

  service.catalogItems.forEach((item, index) => {
    currentY = ensurePdfSpace(doc, currentY, 18);
    appendPdfKeyValue(doc, `#${index + 1} ${item.definition.nome}`, '', currentY);
    currentY += 6;
    appendPdfKeyValue(doc, 'Quantidade', String(item.quantidade), currentY, [71, 85, 105]);
    currentY += 6;
    appendPdfKeyValue(doc, 'Subtotal', formatCurrency(item.valorTotal), currentY, [71, 85, 105]);
    if (item.observacoes) {
      currentY += 6;
      const wrapped = doc.splitTextToSize(item.observacoes, 180);
      doc.text(wrapped, 15, currentY);
      currentY += wrapped.length * 6;
    }
    currentY += 4;
  });

  currentY = ensurePdfSpace(doc, currentY, 16);
  addPdfSectionTitle(doc, 'Produtos utilizados', currentY);
  currentY += 8;

  if (service.items.length === 0) {
    appendPdfKeyValue(doc, 'Itens', 'Nenhum produto aplicado', currentY, [100, 116, 139]);
    currentY += 10;
  }

  service.items.forEach((item, index) => {
    currentY = ensurePdfSpace(doc, currentY, 18);
    appendPdfKeyValue(doc, `#${index + 1} ${item.product.nome}`, '', currentY);
    currentY += 6;
    appendPdfKeyValue(doc, 'Quantidade', String(item.quantidade), currentY, [71, 85, 105]);
    currentY += 6;
    appendPdfKeyValue(doc, 'Subtotal', formatCurrency(item.valorTotal), currentY, [71, 85, 105]);
    currentY += 4;
  });

  currentY = ensurePdfSpace(doc, currentY, 20);
  addPdfSectionTitle(doc, 'Totais do atendimento', currentY);
  currentY += 8;

  const servicesTotal = service.catalogItems.reduce((sum, item) => sum + item.valorTotal, 0);
  const productsTotal = service.items.reduce((sum, item) => sum + item.valorTotal, 0);
  const overallTotal = service.preco ?? servicesTotal + productsTotal;

  appendPdfKeyValue(doc, 'Serviços', formatCurrency(servicesTotal), currentY);
  currentY += 6;
  appendPdfKeyValue(doc, 'Produtos', formatCurrency(productsTotal), currentY);
  currentY += 6;
  appendPdfKeyValue(doc, 'Total geral', formatCurrency(overallTotal), currentY, [15, 23, 42]);

  if (service.notes?.length) {
    currentY += 12;
    addPdfSectionTitle(doc, 'Prontuário do atendimento', currentY);
    currentY += 8;

    const sortedNotes = [...service.notes].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    sortedNotes.forEach((note) => {
      const wrapped = doc.splitTextToSize(note.conteudo, 180);
      const entryHeight = 6 + wrapped.length * 6 + 4;
      currentY = ensurePdfSpace(doc, currentY, entryHeight);

      const header = `Autor: ${note.author.nome} — ${formatDateTime(note.createdAt)}`;
      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text(header, 15, currentY);
      currentY += 6;

      doc.text(wrapped, 15, currentY);
      currentY += wrapped.length * 6 + 4;
    });
  } else if (service.observacoes) {
    currentY += 12;
    addPdfSectionTitle(doc, 'Prontuário do atendimento', currentY);
    currentY += 8;

    const wrapped = doc.splitTextToSize(service.observacoes, 180);
    currentY = ensurePdfSpace(doc, currentY, wrapped.length * 6 + 4);
    doc.text(wrapped, 15, currentY);
    currentY += wrapped.length * 6 + 4;
  }

  const fileDate = new Date(service.data).toISOString().split('T')[0];
  doc.save(`atendimento-${fileDate}-${service.animal?.nome ?? 'pet'}.pdf`);
};

