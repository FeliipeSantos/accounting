import { apiRequest } from '@/core/api/client';
import type { DasListing, DasUpdate, GuideStatus } from '@/modules/das/types';

const BASE = '/api/clients/das';

/** Same limit as the server: a DAS PDF is far below 1 MB. */
export const MAX_PDF_BYTES = 1024 * 1024;

/** File contents in base64 (writes only accept JSON, so the PDF travels inside it). */
function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo'));
    reader.readAsDataURL(file);
  });
}

export const dasApi = {
  list: (period: string) => apiRequest<DasListing>(`${BASE}?period=${encodeURIComponent(period)}`),
  setStatus: (clientId: number, period: string, status: GuideStatus) => apiRequest<DasUpdate>(`${BASE}/${clientId}/${period}`, { method: 'PUT', body: { status } }),
  /** Sends the guide PDF downloaded from the PGMEI: the server checks CNPJ and competência and reads the guide. */
  async uploadPdf(clientId: number, period: string, file: File): Promise<DasUpdate> {
    if (file.size > MAX_PDF_BYTES) throw new Error('Arquivo muito grande: o PDF do DAS tem menos de 1 MB');
    return apiRequest<DasUpdate>(`${BASE}/${clientId}/${period}/pdf`, { method: 'POST', body: { content: await toBase64(file) } });
  },
  pdfUrl: (clientId: number, period: string) => `${BASE}/${clientId}/${period}/pdf`,
};
