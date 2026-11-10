import { WalletOutlined } from '@ant-design/icons';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { receiptsApi } from '@/modules/receipts/api';
import { balanceState, RECEIPTS_PATH } from '@/modules/receipts/format';

/** Global search inside Recebimentos: clients with entries, with their current balance. */
export const receiptsSearch: ModuleSearch = {
  placeholder: 'Buscar recebimentos por cliente...',
  noun: 'recebimentos',
  everything: 'todos os recebimentos',
  allResultsPath: (term) => `${RECEIPTS_PATH}?q=${encodeURIComponent(term)}`,
  search: async (term) => {
    const needle = term.trim().toLowerCase();
    // os saldos vêm sempre de todo o histórico; a data no futuro só evita trazer os lançamentos
    const { balances } = await receiptsApi.list({ from: '9999-12-31' });
    return balances
      .filter((b) => b.name.toLowerCase().includes(needle))
      .slice(0, SEARCH_MAX_RESULTS)
      .map((b) => {
        const state = balanceState(b.balance);
        return {
          id: String(b.clientId),
          title: b.name,
          description: state.text,
          icon: <WalletOutlined />,
          tone: state.label === 'Em aberto' ? ('orange' as const) : ('green' as const),
          path: `${RECEIPTS_PATH}?q=${encodeURIComponent(b.name)}`,
        };
      });
  },
};
