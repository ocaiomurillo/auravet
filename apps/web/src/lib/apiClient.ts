import type {
  Animal,
  Appointment,
  AttendanceType,
  DashboardSummaryResponse,
  Attendance,
  Invoice,
  InvoiceListResponse,
  InvoiceStatus,
  Product,
  ServiceProfessional,
  ServiceDefinition,
} from '../types/api';
import { UNAUTHORIZED_EVENT, authStorage } from './authStorage';

export class ApiConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiConfigurationError';
  }
}

const resolveApiUrl = (): string => {
  const configuredUrl = import.meta.env.VITE_API_URL;

  if (configuredUrl) {
    return configuredUrl;
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:4000';
  }

  throw new ApiConfigurationError(
    'Configuração ausente: defina a variável de ambiente VITE_API_URL antes de gerar o build de produção do frontend.',
  );
};

let cachedApiUrl: string | null = null;

export const getApiBaseUrl = (): string => {
  if (cachedApiUrl === null) {
    cachedApiUrl = resolveApiUrl();
  }

  return cachedApiUrl;
};

export const ensureApiConfigured = (): void => {
  getApiBaseUrl();
};

async function request<T>(
  path: string,
  options: RequestInit = {},
  responseType: 'json' | 'text' | 'blob' = 'json',
): Promise<T> {
  const token = authStorage.getToken();

  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);

    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }

    const error = new Error(errorBody?.error ?? 'Não foi possível concluir a solicitação.');
    (error as Error & { status?: number }).status = response.status;
    if (errorBody?.details !== undefined) {
      (error as Error & { details?: unknown }).details = errorBody.details;
    }
    throw error;
  }

  if (response.status === 204) {
    return null as T;
  }

  if (responseType === 'text') {
    return (await response.text()) as T;
  }

  if (responseType === 'blob') {
    return (await response.blob()) as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getText: (path: string) => request<string>(path, {}, 'text'),
  getBlob: (path: string) => request<Blob>(path, {}, 'blob'),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  delete: <T>(path: string) =>
    request<T>(path, {
      method: 'DELETE',
    }),
};

export type CreateAppointmentPayload = {
  animalId: string;
  ownerId?: string;
  veterinarianId: string;
  assistantId?: string;
  scheduledStart: string;
  scheduledEnd: string;
  tipo: AttendanceType;
  status?: Appointment['status'];
  notes?: string;
};

export const appointmentsApi = {
  create: (payload: CreateAppointmentPayload) =>
    apiClient.post<{ appointment: Appointment }>('/appointments', payload),
  list: (filters: { status?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    const query = params.toString();
    const suffix = query ? `?${query}` : '';
    return apiClient.get<{ appointments: Appointment[] }>(`/appointments${suffix}`);
  },
  getById: (id: string) => apiClient.get<{ appointment: Appointment }>(`/appointments/${id}`),
  billable: (ownerId?: string) => {
    const query = ownerId ? `?ownerId=${ownerId}` : '';
    return apiClient.get<Appointment[]>(`/appointments/billable${query}`);
  },
};

export const animalsApi = {
  getById: (id: string) => apiClient.get<Animal>(`/animals/${id}`),
  services: (id: string) => apiClient.get<Attendance[]>(`/animals/${id}/services`),
};

export interface CreateProductPayload {
  nome: string;
  descricao?: string | null;
  custo: number;
  precoVenda: number;
  estoqueAtual: number;
  estoqueMinimo: number;
  isActive: boolean;
  isSellable: boolean;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface AdjustProductStockPayload {
  amount: number;
}

export const productsApi = {
  list: () => apiClient.get<Product[]>('/products'),
  create: (payload: CreateProductPayload) => apiClient.post<Product>('/products', payload),
  update: (id: string, payload: UpdateProductPayload) => apiClient.put<Product>(`/products/${id}`, payload),
  remove: (id: string) => apiClient.delete(`/products/${id}`),
  adjustStock: (id: string, payload: AdjustProductStockPayload) =>
    apiClient.patch<Product>(`/products/${id}/stock`, payload),
};

export interface CreateServiceDefinitionPayload {
  nome: string;
  descricao?: string | null;
  profissional?: ServiceProfessional | null;
  tipo: AttendanceType;
  precoSugerido: number;
}

export const serviceDefinitionsApi = {
  list: () => apiClient.get<ServiceDefinition[]>('/service-definitions'),
  create: (payload: CreateServiceDefinitionPayload) =>
    apiClient.post<ServiceDefinition>('/service-definitions', payload),
  update: (id: string, payload: CreateServiceDefinitionPayload) =>
    apiClient.put<ServiceDefinition>(`/service-definitions/${id}`, payload),
};

export const dashboardApi = {
  summary: () => apiClient.get<DashboardSummaryResponse>('/dashboard/summary'),
};

export const servicesApi = {
  getById: (id: string) => apiClient.get<Attendance>(`/services/${id}`),
  update: (id: string, payload: unknown) => apiClient.put<Attendance>(`/services/${id}`, payload),
};

export interface InvoiceFilters {
  ownerId?: string;
  status?: string;
  from?: string;
  to?: string;
}

const buildInvoiceParams = (filters: InvoiceFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  return params;
};

const buildInvoiceQuery = (filters: InvoiceFilters = {}) => {
  const queryString = buildInvoiceParams(filters).toString();
  return queryString ? `?${queryString}` : '';
};

export const invoicesApi = {
  list: (filters: InvoiceFilters = {}) => apiClient.get<InvoiceListResponse>(`/invoices${buildInvoiceQuery(filters)}`),
  statuses: () => apiClient.get<InvoiceStatus[]>('/invoices/statuses'),
  getById: (id: string) => apiClient.get<Invoice>(`/invoices/${id}`),
  generateFromAppointment: (payload: { appointmentId?: string; serviceId?: string; dueDate?: string }) =>
    apiClient.post<Invoice>('/invoices', payload),
  markAsPaid: (id: string, payload: { paidAt?: string; paymentNotes?: string }) =>
    apiClient.post<Invoice>(`/invoices/${id}/pay`, payload),
  addManualItem: (
    invoiceId: string,
    payload: { description: string; quantity: number; unitPrice: number; productId?: string },
  ) => apiClient.post<Invoice>(`/invoices/${invoiceId}/items`, payload),
  removeManualItem: (invoiceId: string, itemId: string) =>
    apiClient.delete<Invoice>(`/invoices/${invoiceId}/items/${itemId}`),
  exportFile: (filters: InvoiceFilters = {}, format: 'csv' | 'xlsx' = 'xlsx') => {
    const params = buildInvoiceParams(filters);
    params.set('format', format);
    const queryString = params.toString();
    const suffix = queryString ? `?${queryString}` : '';
    return apiClient.getBlob(`/invoices/export${suffix}`);
  },
  print: (id: string) => apiClient.getText(`/invoices/${id}/print`),
};
