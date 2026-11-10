import { BankOutlined, UserOutlined } from '@ant-design/icons';

import { type ModuleSearch, SEARCH_MAX_RESULTS } from '@/core/layout/search';
import { clientsApi } from '@/modules/clients/api';
import { CLIENT_STATUS, CLIENTS_PATH, formatDocument, matchesClient, REGIMES } from '@/modules/clients/format';

/** Global search inside Clientes: name, trade name, contact, city or CPF/CNPJ (same rule as the list). */
export const clientsSearch: ModuleSearch = {
  placeholder: 'Buscar clientes...',
  noun: 'clientes',
  everything: 'todos os clientes',
  allResultsPath: (term) => `${CLIENTS_PATH}?q=${encodeURIComponent(term)}`,
  search: async (term) => {
    const clients = await clientsApi.list();
    return clients
      .filter((client) => matchesClient(client, term))
      .slice(0, SEARCH_MAX_RESULTS)
      .map((client) => ({
        id: String(client.id),
        title: client.name,
        description: [formatDocument(client.document), REGIMES[client.regime], CLIENT_STATUS[client.status].label].join(' · '),
        icon: client.kind === 'pj' ? <BankOutlined /> : <UserOutlined />,
        tone: client.kind === 'pj' ? 'blue' : 'purple',
        path: `${CLIENTS_PATH}?q=${encodeURIComponent(client.name)}`,
      }));
  },
};
