export type JsPDFInstance = {
  setFontSize: (size: number) => void;
  setFont: (fontName: string, fontStyle?: string) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setDrawColor: (r: number, g?: number, b?: number) => void;
  setFillColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  roundedRect: (
    x: number,
    y: number,
    width: number,
    height: number,
    rx: number,
    ry: number,
    style?: string,
  ) => void;
  text: (text: string | string[], x: number, y: number, options?: unknown) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
  addFileToVFS: (fileName: string, data: string) => void;
  addFont: (fileName: string, fontName: string, fontStyle?: string) => void;
  addImage: (
    imageData: string | HTMLImageElement,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) => void;
  addPage: () => void;
  output: (type?: string) => string;
  save: (fileName?: string) => void;
};

export type JsPDFConstructor = new () => JsPDFInstance;

declare global {
  interface Window {
    jspdf?: {
      jsPDF: JsPDFConstructor;
    };
  }
}

let cachedLogoDataUrl: string | null = null;
let cachedJsPdf: JsPDFConstructor | null = null;
let cachedFontName: string | null = null;
let isFontLoaded = false;

const nunitoFontSources = {
  regular: ['/fonts/NunitoSans-Regular.ttf',
    'https://unpkg.com/@fontsource/nunito-sans@latest/files/nunito-sans-latin-400-normal.ttf'],
  bold: ['/fonts/NunitoSans-Bold.ttf',
    'https://unpkg.com/@fontsource/nunito-sans@latest/files/nunito-sans-latin-700-normal.ttf'],
};

const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return window.btoa(binary);
};

const fetchFontFromSources = async (sources: string[]): Promise<string | null> => {
  for (const source of sources) {
    try {
      const response = await fetch(source);
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      return arrayBufferToBase64(buffer);
    } catch (err) {
      void err;
    }
  }

  return null;
};

const generateFallbackLogo = (): string => {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 80;
  const context = canvas.getContext('2d');

  if (context) {
    context.fillStyle = '#0f172a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f8fafc';
    context.font = 'bold 28px Montserrat, Arial, sans-serif';
    context.fillText('Auravet', 24, 48);
  }

  return canvas.toDataURL('image/png');
};

export const loadJsPdf = async (): Promise<JsPDFConstructor> => {
  if (cachedJsPdf) {
    return cachedJsPdf;
  }

  if (typeof window !== 'undefined' && window.jspdf?.jsPDF) {
    cachedJsPdf = window.jspdf.jsPDF;
    return cachedJsPdf;
  }

  const module = (await import(
    // @ts-expect-error -- carregamento dinâmico via CDN para evitar dependência adicional
    /* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
  )) as { jsPDF?: unknown; default?: { jsPDF?: unknown } };
  const constructor = module.jsPDF ?? module.default?.jsPDF;

  if (!constructor) {
    throw new Error('Biblioteca de PDF indisponível no momento. Tente novamente.');
  }

  if (typeof window !== 'undefined') {
    window.jspdf = { jsPDF: constructor as JsPDFConstructor };
  }

  cachedJsPdf = constructor as JsPDFConstructor;
  return cachedJsPdf;
};

export const loadLogoDataUrl = async (): Promise<string> => {
  if (cachedLogoDataUrl) {
    return cachedLogoDataUrl;
  }

  try {
    const response = await fetch('/logo-auravet.svg');
    const svgContent = await response.text();
    const svgBase64 = window.btoa(unescape(encodeURIComponent(svgContent)));
    const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

    await new Promise((resolve, reject) => {
      const image = new Image();
      image.src = svgDataUrl;
      image.onload = () => resolve(true);
      image.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 80;
    const context = canvas.getContext('2d');

    if (context) {
      const image = new Image();
      image.src = svgDataUrl;
      await new Promise((resolve, reject) => {
        image.onload = () => resolve(true);
        image.onerror = reject;
      });
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      cachedLogoDataUrl = canvas.toDataURL('image/png');
      return cachedLogoDataUrl;
    }
  } catch (err) {
    void err;
  }

  cachedLogoDataUrl = generateFallbackLogo();
  return cachedLogoDataUrl;
};

export const applyPdfBrandFont = async (doc: JsPDFInstance): Promise<string> => {
  if (isFontLoaded && cachedFontName) {
    doc.setFont(cachedFontName, 'normal');
    return cachedFontName;
  }

  const [regularFont, boldFont] = await Promise.all([
    fetchFontFromSources(nunitoFontSources.regular),
    fetchFontFromSources(nunitoFontSources.bold),
  ]);

  if (regularFont && boldFont) {
    doc.addFileToVFS('NunitoSans-Regular.ttf', regularFont);
    doc.addFont('NunitoSans-Regular.ttf', 'NunitoSans', 'normal');
    doc.addFileToVFS('NunitoSans-Bold.ttf', boldFont);
    doc.addFont('NunitoSans-Bold.ttf', 'NunitoSans', 'bold');
    cachedFontName = 'NunitoSans';
  } else {
    cachedFontName = 'helvetica';
  }

  isFontLoaded = cachedFontName === 'NunitoSans';
  doc.setFont(cachedFontName, 'normal');
  return cachedFontName;
};
