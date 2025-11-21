import { SerializedInvoice } from './serializers';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#39;');

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';

const buildOwnerAddress = (invoice: SerializedInvoice) => {
  const { owner } = invoice;
  const parts = [
    owner.logradouro,
    owner.numero,
    owner.bairro,
    owner.cidade,
    owner.estado,
    owner.cep,
  ]
    .filter((part): part is string => Boolean(part))
    .map((part) => escapeHtml(part));

  return parts.join(' • ');
};

export const buildInvoicePrintHtml = (invoice: SerializedInvoice) => {
  const ownerCpf = invoice.owner.cpf ?? null;
  const ownerAddress = buildOwnerAddress(invoice);
  const responsibleName = invoice.responsible?.nome ?? null;
  const responsibleEmail = invoice.responsible?.email ?? null;

  const itemsRows = invoice.items
    .map((item, index) => {
      const description = escapeHtml(item.description);
      const serviceDetails = item.service
        ? `Atendimento em ${formatDate(item.service.data)}${
            item.service.animal?.nome
              ? ` • Pet: ${escapeHtml(item.service.animal.nome)}`
              : ''
          }`
        : '';

      return `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div>${description}</div>
            ${serviceDetails ? `<small>${serviceDetails}</small>` : ''}
          </td>
          <td>${item.quantity}</td>
          <td>${currencyFormatter.format(item.unitPrice)}</td>
          <td>${currencyFormatter.format(item.total)}</td>
        </tr>
      `;
    })
    .join('');

  const paymentNotes = invoice.paymentNotes ? escapeHtml(invoice.paymentNotes) : null;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Conta ${escapeHtml(invoice.id)}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; margin: 0; padding: 24px; color: #1f2933; }
      h1 { margin-bottom: 4px; }
      .subtitle { color: #52606d; margin-top: 0; }
      .grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); margin-bottom: 24px; }
      .card { background: #f8fafc; border-radius: 12px; padding: 16px; border: 1px solid #d2d6dc; }
      table { width: 100%; border-collapse: collapse; margin-top: 16px; }
      th, td { border-bottom: 1px solid #d2d6dc; padding: 8px 12px; text-align: left; font-size: 14px; }
      th { background: #e4ebf5; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; color: #52606d; }
      td small { display: block; color: #52606d; margin-top: 4px; }
      .total { text-align: right; font-size: 18px; font-weight: 600; margin-top: 16px; }
      .notes { margin-top: 24px; white-space: pre-wrap; background: #f1f5f9; padding: 12px; border-radius: 8px; border: 1px solid #d2d6dc; }
      @media print {
        body { padding: 0; }
        .no-print { display: none; }
      }
    </style>
  </head>
  <body>
    <div class="no-print" style="display: flex; justify-content: flex-end; margin-bottom: 16px;">
      <button onclick="window.print()" style="padding: 8px 16px; border-radius: 999px; border: none; background: #1f2933; color: #fff; font-weight: 600; cursor: pointer;">Imprimir</button>
    </div>
    <h1>Conta ${escapeHtml(invoice.id)}</h1>
    <p class="subtitle">Emitida para ${escapeHtml(invoice.owner.nome)}</p>

    <div class="grid">
      <div class="card">
        <strong>Tutor</strong>
        <p>${escapeHtml(invoice.owner.nome)}</p>
        ${invoice.owner.email ? `<small>${escapeHtml(invoice.owner.email)}</small>` : ''}
        ${invoice.owner.telefone ? `<small>${escapeHtml(invoice.owner.telefone)}</small>` : ''}
        ${ownerCpf ? `<small>CPF: ${escapeHtml(ownerCpf)}</small>` : ''}
        ${ownerAddress ? `<small>${ownerAddress}</small>` : ''}
      </div>
      <div class="card">
        <strong>Status</strong>
        <p>${escapeHtml(invoice.status.name)}</p>
        <small>Vencimento: ${formatDate(invoice.dueDate)}</small>
        <small>Pagamento: ${formatDate(invoice.paidAt)}</small>
      </div>
      <div class="card">
        <strong>Responsável</strong>
        <p>${responsibleName ? escapeHtml(responsibleName) : '—'}</p>
        ${responsibleEmail ? `<small>${escapeHtml(responsibleEmail)}</small>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Item</th>
          <th>Qtd</th>
          <th>Valor unitário</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <p class="total">Total: ${currencyFormatter.format(invoice.total)}</p>
    ${paymentNotes ? `<div class="notes"><strong>Notas de pagamento</strong><br />${paymentNotes}</div>` : ''}
  </body>
</html>`;
};
