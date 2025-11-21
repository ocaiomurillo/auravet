export type JsPDFInstance = {
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g?: number, b?: number) => void;
  setLineWidth: (width: number) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  text: (text: string | string[], x: number, y: number, options?: unknown) => void;
  splitTextToSize: (text: string, maxWidth: number) => string[];
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
    const response = await fetch('/favicon.svg');
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
