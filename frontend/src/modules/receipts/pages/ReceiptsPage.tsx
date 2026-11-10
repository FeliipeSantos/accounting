import {
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  LeftOutlined,
  PlusOutlined,
  RightOutlined,
  RiseOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, DatePicker, Flex, Select, Table, Tag, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { ErrorState, LoadingState, SectionCard, StatCard, StatusBadge } from '@/core/ui';
import { clientsApi } from '@/modules/clients/api';
import { formatMoney } from '@/modules/clients/format';
import type { Client } from '@/modules/clients/types';
import { receiptsApi, serviceTypesApi } from '@/modules/receipts/api';
import { ReceiptFormModal } from '@/modules/receipts/components/ReceiptFormModal';
import { ServiceTypesModal } from '@/modules/receipts/components/ServiceTypesModal';
import { balanceState, OTHER_SERVICE, PAYMENT_METHODS, serviceLabel, totals } from '@/modules/receipts/format';
import type { Receipt, ReceiptInput, ReceiptListing, ServiceType } from '@/modules/receipts/types';
import { colors } from '@/theme';

const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-items: stretch;

  @media (max-width: 1100px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
  align-items: start;

  @media (max-width: 1200px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const NewButton = styled(Button)`
  &&& {
    height: 44px;
    padding-inline: 22px;
    box-shadow: 0 8px 18px -8px rgba(30, 107, 230, 0.6);
  }
`;

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: ${colors.navy};
`;

const MonthPicker = styled(DatePicker)`
  width: 160px;
`;

const ClientFilter = styled(Select<number>)`
  min-width: 220px;
`;

const Name = styled.div`
  font-weight: 500;
  color: ${colors.textDark};
  overflow-wrap: anywhere;
`;

const Sub = styled.div`
  color: ${colors.textMuted};
  font-size: 12px;
`;

const Money = styled.span`
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

const StyledTable = styled(Table<Receipt>)`
  .ant-table-thead > tr > th {
    background: transparent;
    color: ${colors.textDark};
    font-weight: 500;
    font-size: 13px;
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }
`;

const BalanceList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const BalanceRow = styled.li`
  border-bottom: 1px solid ${colors.border};

  &:last-child {
    border-bottom: none;
  }

  button {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    background: none;
    border: none;
    font: inherit;
    text-align: left;
    cursor: pointer;
    color: inherit;
  }

  button:hover strong {
    color: ${colors.blue};
  }
`;

const Empty = styled.p`
  margin: 0;
  color: ${colors.textMuted};
  font-size: 13px;
`;

/** null: form closed; "new": creating; a receipt: editing it. */
type Editing = null | 'new' | Receipt;

export function ReceiptsPage() {
  const { message, modal } = App.useApp();
  const [params, setParams] = useSearchParams();
  const search = (params.get('q') ?? '').trim().toLowerCase();
  const [month, setMonth] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [clientId, setClientId] = useState<number | undefined>();
  const [listing, setListing] = useState<ReceiptListing | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [managingTypes, setManagingTypes] = useState(false);

  useEffect(() => {
    clientsApi
      .list()
      .then(setClients)
      .catch(() => undefined);
  }, []);

  // recarrega junto com os lançamentos: a contagem de uso de cada tipo muda a cada lançamento
  useEffect(() => {
    serviceTypesApi
      .list()
      .then(setTypes)
      .catch(() => undefined);
  }, [reloadKey]);

  /** Adds a type typed in the form; the new type goes to the end of the list. */
  async function addType(name: string): Promise<ServiceType | null> {
    try {
      const created = await serviceTypesApi.create(name);
      setTypes((current) => [...current, created]);
      message.success(`"${created.name}" adicionado`);
      return created;
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) message.error(errorMessage(err));
      return null;
    }
  }

  function changeTypes(next: ServiceType[]) {
    setTypes(next);
    // nomes novos aparecem também nos lançamentos já carregados
    setReloadKey((k) => k + 1);
  }

  useEffect(() => {
    let active = true;
    setListing(null);
    setError(null);
    receiptsApi
      .list({ from: month.format('YYYY-MM-DD'), to: month.endOf('month').format('YYYY-MM-DD'), clientId })
      .then((data) => active && setListing(data))
      .catch((err) => active && !(err instanceof SessionExpiredError) && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [month, clientId, reloadKey]);

  const items = useMemo(() => (listing?.items ?? []).filter((r) => !search || r.clientName.toLowerCase().includes(search)), [listing, search]);
  const balances = useMemo(() => listing?.balances ?? [], [listing]);
  const sums = useMemo(() => totals(items, balances), [items, balances]);
  const balanceOf = (id: number) => balances.find((b) => b.clientId === id)?.balance ?? 0;
  const open = balances.filter((b) => Math.round(b.balance * 100) !== 0);

  async function save(input: ReceiptInput) {
    setSaving(true);
    try {
      if (editing && editing !== 'new') await receiptsApi.update(editing.id, input);
      else await receiptsApi.create(input);
      message.success(editing && editing !== 'new' ? 'Recebimento atualizado' : 'Recebimento lançado');
      setEditing(null);
      // recarrega para trazer os saldos de todos os clientes atualizados
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(err)}`);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(receipt: Receipt) {
    modal.confirm({
      title: 'Excluir recebimento',
      content: `O lançamento de ${formatMoney(receipt.received)} de ${receipt.clientName} (${dayjs(receipt.receivedOn).format('DD/MM/YYYY')}) será excluído e o saldo do cliente recalculado.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await receiptsApi.remove(receipt.id);
          message.success('Recebimento excluído');
          setReloadKey((k) => k + 1);
        } catch (err) {
          if (!(err instanceof SessionExpiredError)) message.error(`Não foi possível excluir: ${errorMessage(err)}`);
        }
      },
    });
  }

  function clearSearch() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('q');
      return next;
    });
  }

  const value = (n: string) => (listing ? n : '—');
  const monthLabel = month.format('MMMM/YYYY');

  return (
    <Page
      icon={<WalletOutlined />}
      title="Recebimentos"
      description="Lance o que cada cliente pagou por serviço. O que for pago a mais fica como crédito para os próximos serviços."
      actions={
        <>
          <Button size="large" icon={<UnorderedListOutlined />} onClick={() => setManagingTypes(true)}>
            Tipos de trabalho
          </Button>
          <NewButton type="primary" size="large" icon={<PlusOutlined />} onClick={() => setEditing('new')}>
            Novo Recebimento
          </NewButton>
        </>
      }
    >
      {clients.length === 0 && listing && <Alert type="info" showIcon message="Cadastre os seus clientes na tela Clientes para lançar os recebimentos deles." />}

      <StatsRow>
        <StatCard
          icon={<WalletOutlined />}
          iconTone="green"
          label={`Recebido em ${monthLabel}`}
          value={value(formatMoney(sums.received))}
          small
          hint={`${items.length} lançamento${items.length === 1 ? '' : 's'}`}
        />
        <StatCard icon={<FileTextOutlined />} iconTone="blue" label={`Cobrado em ${monthLabel}`} value={value(formatMoney(sums.charged))} small />
        <StatCard
          icon={<RiseOutlined />}
          iconTone="purple"
          label="Créditos de clientes"
          value={value(formatMoney(sums.credit))}
          small
          hint={sums.creditClients ? `${sums.creditClients} cliente${sums.creditClients > 1 ? 's' : ''} com crédito` : 'nenhum crédito'}
        />
        <StatCard
          icon={<ClockCircleOutlined />}
          iconTone="orange"
          label="A receber"
          value={value(formatMoney(sums.open))}
          small
          tone={sums.open > 0 ? 'warning' : undefined}
          hint={sums.openClients ? `${sums.openClients} cliente${sums.openClients > 1 ? 's' : ''} em aberto` : 'nada em aberto'}
        />
      </StatsRow>

      <Columns>
        <SectionCard
          title={
            <CardTitle>
              <WalletOutlined /> Lançamentos
            </CardTitle>
          }
          extra={
            <Flex gap={8} align="center" wrap>
              {search && (
                <Tag icon={<SearchOutlined />} closable onClose={clearSearch}>
                  “{params.get('q')}”
                </Tag>
              )}
              <ClientFilter
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="Todos os clientes"
                value={clientId}
                onChange={setClientId}
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
              />
              <Button icon={<LeftOutlined />} onClick={() => setMonth((m) => m.subtract(1, 'month'))} aria-label="Mês anterior" />
              <MonthPicker picker="month" format="MMMM/YYYY" allowClear={false} value={month} onChange={(v) => v && setMonth((v as Dayjs).startOf('month'))} aria-label="Mês" />
              <Button icon={<RightOutlined />} onClick={() => setMonth((m) => m.add(1, 'month'))} aria-label="Próximo mês" />
            </Flex>
          }
          flush
        >
          {error ? (
            <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : !listing ? (
            <LoadingState rows={5} />
          ) : (
            <StyledTable
              rowKey="id"
              dataSource={items}
              pagination={items.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
              scroll={{ x: 900 }}
              locale={{ emptyText: `Nenhum recebimento em ${monthLabel}. Clique em "Novo Recebimento" para lançar.` }}
              columns={[
                { title: 'Data', key: 'date', width: 100, render: (_, r) => <Money>{dayjs(r.receivedOn).format('DD/MM/YYYY')}</Money> },
                {
                  title: 'Cliente',
                  key: 'client',
                  render: (_, r) => <Name>{r.clientName}</Name>,
                },
                {
                  title: 'Trabalho realizado',
                  key: 'service',
                  render: (_, r) => (
                    <div>
                      <div>{serviceLabel(r)}</div>
                      {(r.period || (r.serviceCode !== OTHER_SERVICE && r.description) || r.method) && (
                        <Sub>
                          {[
                            r.period && `competência ${dayjs(`${r.period}-01`).format('MM/YYYY')}`,
                            r.serviceCode !== OTHER_SERVICE && r.description,
                            r.method && PAYMENT_METHODS[r.method],
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </Sub>
                      )}
                    </div>
                  ),
                },
                { title: 'Cobrado', key: 'charged', align: 'right', width: 120, render: (_, r) => <Money>{formatMoney(r.charged)}</Money> },
                { title: 'Recebido', key: 'received', align: 'right', width: 120, render: (_, r) => <Money>{formatMoney(r.received)}</Money> },
                {
                  title: 'Diferença',
                  key: 'difference',
                  width: 150,
                  render: (_, r) => {
                    const state = balanceState(r.difference);
                    if (state.label === 'Quitado') return <StatusBadge tone="neutral">Pago exato</StatusBadge>;
                    return (
                      <StatusBadge tone={state.tone}>{state.label === 'Crédito' ? `+${formatMoney(r.difference)} crédito` : `${formatMoney(-r.difference)} em aberto`}</StatusBadge>
                    );
                  },
                },
                {
                  title: 'Ações',
                  key: 'actions',
                  align: 'right',
                  width: 90,
                  render: (_, r) => (
                    <Flex justify="flex-end" gap={2}>
                      <Tooltip title="Editar">
                        <ActionButton type="text" icon={<EditOutlined />} onClick={() => setEditing(r)} aria-label={`Editar o recebimento de ${r.clientName}`} />
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <ActionButton type="text" icon={<DeleteOutlined />} onClick={() => confirmDelete(r)} aria-label={`Excluir o recebimento de ${r.clientName}`} />
                      </Tooltip>
                    </Flex>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>

        <SectionCard
          title={
            <CardTitle>
              <RiseOutlined /> Saldos dos clientes
            </CardTitle>
          }
        >
          {error ? (
            <Empty>Não foi possível carregar os saldos.</Empty>
          ) : !listing ? (
            <LoadingState rows={3} />
          ) : open.length === 0 ? (
            <Empty>Nenhum cliente com crédito ou valor em aberto.</Empty>
          ) : (
            <BalanceList>
              {open.map((b) => {
                const state = balanceState(b.balance);
                return (
                  <BalanceRow key={b.clientId}>
                    <button type="button" onClick={() => setClientId(b.clientId)} title={`Ver os lançamentos de ${b.name}`}>
                      <strong>{b.name}</strong>
                      <StatusBadge tone={state.tone}>{state.text}</StatusBadge>
                    </button>
                  </BalanceRow>
                );
              })}
            </BalanceList>
          )}
        </SectionCard>
      </Columns>

      <ReceiptFormModal
        open={editing !== null}
        receipt={editing === 'new' ? null : editing}
        defaultClientId={clientId}
        clients={clients}
        types={types}
        onAddType={addType}
        balanceOf={balanceOf}
        saving={saving}
        onSave={save}
        onCancel={() => setEditing(null)}
      />

      <ServiceTypesModal open={managingTypes} types={types} onChange={changeTypes} onClose={() => setManagingTypes(false)} />
    </Page>
  );
}
