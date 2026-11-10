import { apiRequest } from '@/core/api/client';
import type { Client, ClientInput } from '@/modules/clients/types';

const BASE = '/api/clients';

export const clientsApi = {
  list: () => apiRequest<Client[]>(BASE),
  create: (input: ClientInput) => apiRequest<Client>(BASE, { method: 'POST', body: input }),
  update: (id: number, input: ClientInput) => apiRequest<Client>(`${BASE}/${id}`, { method: 'PUT', body: input }),
  remove: (id: number) => apiRequest<{ success: true }>(`${BASE}/${id}`, { method: 'DELETE' }),
};
