import { apiRequest } from '@/core/api/client';
import type { Receipt, ReceiptInput, ReceiptListing, ServiceType } from '@/modules/receipts/types';

const BASE = '/api/clients/receipts';

export interface ReceiptFilters {
  from?: string;
  to?: string;
  clientId?: number;
}

export const receiptsApi = {
  list: ({ from, to, clientId }: ReceiptFilters = {}) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (clientId) params.set('clientId', String(clientId));
    const query = params.toString();
    return apiRequest<ReceiptListing>(query ? `${BASE}?${query}` : BASE);
  },
  create: (input: ReceiptInput) => apiRequest<Receipt>(BASE, { method: 'POST', body: input }),
  update: (id: number, input: ReceiptInput) => apiRequest<Receipt>(`${BASE}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => apiRequest<{ success: true }>(`${BASE}/${id}`, { method: 'DELETE' }),
};

const TYPES = '/api/clients/service-types';

export const serviceTypesApi = {
  list: () => apiRequest<ServiceType[]>(TYPES),
  create: (name: string) => apiRequest<ServiceType>(TYPES, { method: 'POST', body: { name } }),
  update: (id: number, changes: { name?: string; active?: boolean }) => apiRequest<ServiceType>(`${TYPES}/${id}`, { method: 'PUT', body: changes }),
  remove: (id: number) => apiRequest<{ success: true }>(`${TYPES}/${id}`, { method: 'DELETE' }),
};
