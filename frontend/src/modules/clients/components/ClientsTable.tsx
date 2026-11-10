import { BankOutlined, DeleteOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Flex, Table, Tooltip } from 'antd';
import styled from 'styled-components';

import { IconCircle, StatusBadge } from '@/core/ui';
import { CLIENT_STATUS, formatDocument, formatMoney, formatPlace, REGIMES } from '@/modules/clients/format';
import type { Client } from '@/modules/clients/types';
import { colors } from '@/theme';

const Name = styled.button`
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 600;
  color: ${colors.textDark};
  text-align: left;
  cursor: pointer;
  overflow-wrap: anywhere;

  &:hover {
    color: ${colors.blue};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Sub = styled.div`
  color: ${colors.textMuted};
  font-size: 12px;
  overflow-wrap: anywhere;
`;

const Mono = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const ActionButton = styled(Button)`
  &&& {
    color: ${colors.textMuted};
  }

  &&&:hover {
    color: ${colors.blue};
  }
`;

const StyledTable = styled(Table<Client>)`
  .ant-table-thead > tr > th {
    background: transparent;
    color: ${colors.textDark};
    font-weight: 600;
    font-size: 13px;
  }

  .ant-table-tbody > tr > td {
    padding-block: 12px;
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }
`;

interface ClientsTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  emptyText: string;
}

/** One row per client: name, CPF/CNPJ, regime, place, contact, fee, status and actions. */
export function ClientsTable({ clients, onEdit, onDelete, emptyText }: ClientsTableProps) {
  return (
    <StyledTable
      rowKey="id"
      dataSource={clients}
      pagination={clients.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
      scroll={{ x: 1000 }}
      locale={{ emptyText }}
      columns={[
        {
          title: 'Cliente',
          key: 'name',
          render: (_, client) => (
            <Flex align="center" gap={12}>
              <IconCircle $tone={client.kind === 'pj' ? 'blue' : 'purple'} $size={32} aria-hidden>
                {client.kind === 'pj' ? <BankOutlined /> : <UserOutlined />}
              </IconCircle>
              <div>
                <Name type="button" onClick={() => onEdit(client)}>
                  {client.name}
                </Name>
                {client.tradeName && <Sub>{client.tradeName}</Sub>}
              </div>
            </Flex>
          ),
        },
        { title: 'CPF/CNPJ', key: 'document', render: (_, client) => <Mono>{formatDocument(client.document)}</Mono> },
        { title: 'Regime', key: 'regime', render: (_, client) => REGIMES[client.regime] },
        { title: 'Município', key: 'place', render: (_, client) => formatPlace(client) },
        {
          title: 'Contato',
          key: 'contact',
          render: (_, client) =>
            client.contactName || client.email || client.phone ? (
              <div>
                {client.contactName && <div>{client.contactName}</div>}
                {(client.email || client.phone) && <Sub>{[client.email, client.phone].filter(Boolean).join(' · ')}</Sub>}
              </div>
            ) : (
              '—'
            ),
        },
        { title: 'Honorário', key: 'fee', align: 'right', render: (_, client) => <Mono>{formatMoney(client.monthlyFee)}</Mono> },
        {
          title: 'Situação',
          key: 'status',
          render: (_, client) => <StatusBadge tone={CLIENT_STATUS[client.status].tone}>{CLIENT_STATUS[client.status].label}</StatusBadge>,
        },
        {
          title: 'Ações',
          key: 'actions',
          align: 'right',
          width: 100,
          render: (_, client) => (
            <Flex justify="flex-end" gap={2}>
              <Tooltip title="Editar">
                <ActionButton type="text" icon={<EditOutlined />} onClick={() => onEdit(client)} aria-label={`Editar ${client.name}`} />
              </Tooltip>
              <Tooltip title="Excluir">
                <ActionButton type="text" icon={<DeleteOutlined />} onClick={() => onDelete(client)} aria-label={`Excluir ${client.name}`} />
              </Tooltip>
            </Flex>
          ),
        },
      ]}
    />
  );
}
