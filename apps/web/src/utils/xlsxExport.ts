import type { CellValue } from './xlsxTypes';
import { createZipBlob } from './zipBuilder';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const SHEET_NAME_MAX_LENGTH = 31;

const invalidSheetCharacters = new RegExp('[\\/*?:\\[\\]]', 'g');

const sanitizeSheetName = (name: string): string => {
  const trimmed = name.trim().slice(0, SHEET_NAME_MAX_LENGTH);
  return trimmed.replace(invalidSheetCharacters, ' ').trim() || 'Dados';
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const columnLetterFromIndex = (index: number): string => {
  let currentIndex = index;
  let column = '';

  while (currentIndex >= 0) {
    column = String.fromCharCode((currentIndex % 26) + 65) + column;
    currentIndex = Math.floor(currentIndex / 26) - 1;
  }

  return column;
};

const buildSheetXml = (rows: CellValue[][]): string => {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, cellIndex) => {
          const cellReference = `${columnLetterFromIndex(cellIndex)}${rowIndex + 1}`;

          if (typeof cell === 'number') {
            return `<c r="${cellReference}"><v>${cell}</v></c>`;
          }

          const text = escapeXml(String(cell ?? ''));
          return `<c r="${cellReference}" t="inlineStr"><is><t>${text}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;
};

const buildWorkbookXml = (sheetName: string): string =>
  `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1" /></sheets></workbook>`;

const workbookRelsXml =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml" /></Relationships>';

const contentTypesXml =
  '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" /><Default Extension="xml" ContentType="application/xml" /><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" /><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml" /></Types>';

const rootRelsXml =
  '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml" /></Relationships>';

interface XlsxWorkbookOptions {
  sheetName: string;
  headers: readonly (CellValue | undefined)[];
  rows: (CellValue | undefined)[][];
}

export const createXlsxBlob = ({ sheetName, headers, rows }: XlsxWorkbookOptions): Blob => {
  const normalizedSheetName = sanitizeSheetName(sheetName);
  const worksheetRows: CellValue[][] = [headers.map((cell) => cell ?? '') as CellValue[], ...rows.map((row) => row.map((cell) => cell ?? ''))];

  const entries = [
    { path: '[Content_Types].xml', data: contentTypesXml },
    { path: '_rels/.rels', data: rootRelsXml },
    { path: 'xl/workbook.xml', data: buildWorkbookXml(normalizedSheetName) },
    { path: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { path: 'xl/worksheets/sheet1.xml', data: buildSheetXml(worksheetRows) },
  ];

  return createZipBlob(
    entries.map((entry) => ({ path: entry.path, data: entry.data, mimeType: XLSX_MIME })),
    XLSX_MIME,
  );
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
