/** Kind of work charged (managed on the screen). `code` marks the built-in ones the screen relies on. */
export interface ServiceType {
  id: number;
  name: string;
  code: string | null;
  /** Inactive types leave the choices but stay on old entries. */
  active: boolean;
  position: number;
  /** Number of entries using it (a used type can only be deactivated). */
  uses: number;
}

export type PaymentMethod = 'pix' | 'transferencia' | 'boleto' | 'dinheiro' | 'cartao' | 'outro';

/** One entry of a client's account: amount charged for a service and amount received (in reais). */
export interface Receipt {
  id: number;
  clientId: number;
  clientName: string;
  /** Date of the payment, AAAA-MM-DD. */
  receivedOn: string;
  serviceTypeId: number;
  serviceName: string;
  serviceCode: string | null;
  description: string | null;
  /** Competência (AAAA-MM), when the service refers to a month. */
  period: string | null;
  charged: number;
  received: number;
  /** received - charged: positive becomes credit, negative is still to receive. */
  difference: number;
  method: PaymentMethod | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A client's account over all entries: positive balance is credit, negative is still to receive. */
export interface ClientBalance {
  clientId: number;
  name: string;
  charged: number;
  received: number;
  balance: number;
}

export interface ReceiptListing {
  items: Receipt[];
  balances: ClientBalance[];
}

export type ReceiptInput = Pick<Receipt, 'clientId' | 'receivedOn' | 'serviceTypeId' | 'description' | 'period' | 'charged' | 'received' | 'method' | 'notes'>;
