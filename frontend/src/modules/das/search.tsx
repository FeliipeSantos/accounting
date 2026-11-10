import { BankOutlined } from '@ant-design/icons';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { formatDocument } from '@/modules/clients/format';
import { dasApi } from '@/modules/das/api';
import { DAS_PATH, defaultPeriod, GUIDE_STATUS, matchesGuide, periodLabel } from '@/modules/das/format';

/** Global search inside Geração de DAS: MEI clients of the current competência by name or CNPJ. */
export const dasSearch: ModuleSearch = {
  placeholder: 'Buscar clientes MEI...',
  noun: 'clientes MEI',
  everything: 'todos os clientes MEI',
  allResultsPath: (term) => `${DAS_PATH}?q=${encodeURIComponent(term)}`,
  search: async (term) => {
    const period = defaultPeriod();
    const { items } = await dasApi.list(period);
    return items
      .filter((item) => matchesGuide(item, term))
      .slice(0, SEARCH_MAX_RESULTS)
      .map((item) => ({
        id: String(item.clientId),
        title: item.name,
        description: `${formatDocument(item.document)} · ${periodLabel(period)}: ${GUIDE_STATUS[item.status].label}`,
        icon: <BankOutlined />,
        tone: 'blue' as const,
        path: `${DAS_PATH}?q=${encodeURIComponent(item.name)}`,
      }));
  },
};
