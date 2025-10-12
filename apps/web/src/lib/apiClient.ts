import type { Invoice, InvoiceListResponse, InvoiceStatus, Product, Service } from '../types/api';
import { UNAUTHORIZED_EVENT, authStorage } from './authStorage';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request<T>(
  path: string,
  options: RequestInit = {},
  responseType: 'json' | 'text' = 'json',
): Promise<T> {
  const token = authStorage.getToken();

  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
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
    throw error;
  }

  if (response.status === 204) {
    return null as T;
  }

  if (responseType === 'text') {
    return (await response.text()) as T;
  }

  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getText: (path: string) => request<string>(path, {}, 'text'),
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

export interface InvoiceFilters {
  ownerId?: string;
  status?: string;
  from?: string;
  to?: string;
}

const buildInvoiceQuery = (filters: InvoiceFilters = {}) => {
  const params = new URLSearchParams();
  if (filters.ownerId) params.set('ownerId', filters.ownerId);
  if (filters.status) params.set('status', filters.status);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
};

export const invoicesApi = {
  list: (filters: InvoiceFilters = {}) => apiClient.get<InvoiceListResponse>(`/invoices${buildInvoiceQuery(filters)}`),
  statuses: () => apiClient.get<InvoiceStatus[]>('/invoices/statuses'),
  candidates: (ownerId?: string) => {
    const query = ownerId ? `?ownerId=${ownerId}` : '';
    return apiClient.get<Service[]>(`/invoices/candidates${query}`);
  },
  generateFromService: (payload: { serviceId: string; dueDate?: string }) =>
    apiClient.post<Invoice>('/invoices', payload),
  markAsPaid: (id: string, payload: { paidAt?: string; paymentNotes?: string }) =>
    apiClient.post<Invoice>(`/invoices/${id}/pay`, payload),
  exportCsv: (filters: InvoiceFilters = {}) =>
    (() => {
      const query = buildInvoiceQuery(filters);
      const separator = query ? '&' : '?';
      return apiClient.getText(`/invoices/export${query}${separator}format=csv`);
    })(),
};
