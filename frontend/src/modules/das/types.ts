import type { ClientStatus, Regime } from '@/modules/clients/types';

export type GuideStatus = 'pendente' | 'gerada' | 'paga';

/** DAS of one MEI client in one competência. */
export interface DasItem {
  clientId: number;
  name: string;
  tradeName: string | null;
  /** CNPJ without punctuation. */
  document: string;
  regime: Regime;
  clientStatus: ClientStatus;
  status: GuideStatus;
  generatedAt: string | null;
  paidAt: string | null;
  /** Read from the guide PDF, when it was sent: payment line (48 digits), amount, due date and number. */
  barcodeLine: string | null;
  amount: number | null;
  dueDate: string | null;
  documentNumber: string | null;
  hasPdf: boolean;
}

export interface DasListing {
  /** Competência, AAAA-MM. */
  period: string;
  /** Due date (AAAA-MM-DD): the 20th of the next month, or the next business day. */
  dueDate: string;
  /** Why the due date moved, when it did. */
  dueNote: string | null;
  items: DasItem[];
}

export type DasUpdate = Pick<DasItem, 'clientId' | 'status' | 'generatedAt' | 'paidAt' | 'barcodeLine' | 'amount' | 'dueDate' | 'documentNumber' | 'hasPdf'> & {
  period: string;
};
