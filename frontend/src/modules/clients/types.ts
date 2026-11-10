export type Regime = 'simples' | 'mei' | 'presumido' | 'real' | 'imune_isenta' | 'pessoa_fisica';
export type ClientStatus = 'ativo' | 'inativo';

/** Client as the server returns it. `document` is the CPF/CNPJ without punctuation. */
export interface Client {
  id: number;
  document: string;
  kind: 'pf' | 'pj';
  name: string;
  tradeName: string | null;
  regime: Regime;
  status: ClientStatus;
  state: string | null;
  city: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  monthlyFee: number | null;
  startDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What the form sends to create or update a client. */
export type ClientInput = Omit<Client, 'id' | 'kind' | 'createdAt' | 'updatedAt'>;
