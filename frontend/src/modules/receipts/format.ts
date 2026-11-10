import { formatMoney } from '@/modules/clients/format';
import type { ClientBalance, PaymentMethod, Receipt, ServiceType } from '@/modules/receipts/types';
import type { Tone } from '@/theme';

export const RECEIPTS_PATH = '/recebimentos';

/** Codes of the built-in service types the screen relies on. */
export const MONTHLY_FEE = 'honorario_mensal';
export const OTHER_SERVICE = 'outro';

/** Types offered in the form: the active ones, plus the entry's own type if it was deactivated since. */
export function typeChoices(types: ServiceType[], currentId?: number): ServiceType[] {
  return types.filter((t) => t.active || t.id === currentId);
}

export const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: 'PIX',
  transferencia: 'Transferência',
  boleto: 'Boleto',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  outro: 'Outro',
};

/** Same limits as the server (app/modules/clients/receipts.py). */
export const LIMITS = { description: 200, notes: 1000 } as const;

/** Balance in cents-safe reais (sums of decimals can carry floating point noise). */
export function roundMoney(value: number): number {
  // "|| 0" evita o zero negativo, que apareceria como "-R$ 0,00"
  return Math.round(value * 100) / 100 || 0;
}

/** How a balance (or an entry difference) reads on the screen: credit, still to receive or settled. */
export function balanceState(value: number): { label: string; tone: Tone; text: string } {
  const amount = roundMoney(value);
  if (amount > 0) return { label: 'Crédito', tone: 'success', text: `Crédito de ${formatMoney(amount)}` };
  if (amount < 0) return { label: 'Em aberto', tone: 'warning', text: `Em aberto ${formatMoney(-amount)}` };
  return { label: 'Quitado', tone: 'neutral', text: 'Sem saldo' };
}

/** Service name shown in the list: the type, or the description for "Outro serviço". */
export function serviceLabel(receipt: Pick<Receipt, 'serviceName' | 'serviceCode' | 'description'>): string {
  return receipt.serviceCode === OTHER_SERVICE && receipt.description ? receipt.description : receipt.serviceName;
}

/** Totals of the entries shown: received, charged and the credit and open amounts of all clients. */
export function totals(items: Receipt[], balances: ClientBalance[]) {
  const received = roundMoney(items.reduce((sum, r) => sum + r.received, 0));
  const charged = roundMoney(items.reduce((sum, r) => sum + r.charged, 0));
  const withCredit = balances.filter((b) => roundMoney(b.balance) > 0);
  const withDebt = balances.filter((b) => roundMoney(b.balance) < 0);
  return {
    received,
    charged,
    credit: roundMoney(withCredit.reduce((sum, b) => sum + b.balance, 0)),
    creditClients: withCredit.length,
    open: roundMoney(-withDebt.reduce((sum, b) => sum + b.balance, 0)),
    openClients: withDebt.length,
  };
}

/**
 * What a client still has to pay for a charge after using the credit, and the balance after
 * this entry. `previous` is the balance before the entry (positive is credit).
 */
export function preview(previous: number, charged: number, received: number) {
  const credit = Math.max(previous, 0);
  return {
    toPay: roundMoney(Math.max(charged - credit, 0)),
    after: roundMoney(previous + received - charged),
  };
}
