import { CheckCircleOutlined, DollarOutlined, PauseCircleOutlined, PlusOutlined, SearchOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, App, Button, Flex, Segmented, Select, Tag } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { LoadingState, SectionCard, StatCard } from '@/core/ui';
import { clientsApi } from '@/modules/clients/api';
import { ClientFormModal } from '@/modules/clients/components/ClientFormModal';
import { ClientsTable } from '@/modules/clients/components/ClientsTable';
import { formatMoney, matchesClient, REGIMES } from '@/modules/clients/format';
import type { Client, ClientInput, ClientStatus, Regime } from '@/modules/clients/types';
import { colors } from '@/theme';

type StatusFilter = 'all' | ClientStatus;

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

const NewButton = styled(Button)`
  &&& {
    height: 44px;
    padding-inline: 22px;
    box-shadow: 0 8px 18px -8px rgba(30, 107, 230, 0.6);
  }
`;

const RegimeSelect = styled(Select<Regime>)`
  min-width: 190px;
`;

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 700;
  color: ${colors.navy};
`;

/** null: form closed; "new": creating; a client: editing it. */
type Editing = null | 'new' | Client;

const byName = (a: Client, b: Client) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

export function ClientsPage() {
  const { message, modal } = App.useApp();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // a busca vem do campo do cabeçalho global ("Ver todos os clientes" abre esta lista com ?q=)
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [status, setStatus] = useState<StatusFilter>('all');
  const [regime, setRegime] = useState<Regime | undefined>();
  const [editing, setEditing] = useState<Editing>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    clientsApi
      .list()
      .then((list) => active && setClients(list))
      .catch((error) => {
        if (!active || error instanceof SessionExpiredError) return;
        setLoadError(true);
        setClients([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => clients ?? [], [clients]);

  const stats = useMemo(() => {
    const active = list.filter((c) => c.status === 'ativo');
    return {
      total: list.length,
      active: active.length,
      inactive: list.length - active.length,
      fees: active.reduce((sum, c) => sum + (c.monthlyFee ?? 0), 0),
    };
  }, [list]);

  const visible = useMemo(
    () => list.filter((c) => (status === 'all' || c.status === status) && (!regime || c.regime === regime) && matchesClient(c, search)),
    [list, status, regime, search],
  );

  async function save(input: ClientInput) {
    setSaving(true);
    try {
      if (editing && editing !== 'new') {
        const updated = await clientsApi.update(editing.id, input);
        setClients((current) => (current ?? []).map((c) => (c.id === updated.id ? updated : c)).sort(byName));
        message.success('Cliente atualizado');
      } else {
        const created = await clientsApi.create(input);
        setClients((current) => [...(current ?? []), created].sort(byName));
        message.success('Cliente cadastrado');
      }
      setEditing(null);
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(client: Client) {
    modal.confirm({
      title: 'Excluir cliente',
      content: `O cliente "${client.name}" será excluído. Para manter o histórico, você pode marcá-lo como Inativo. Esta ação não pode ser desfeita.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await clientsApi.remove(client.id);
          setClients((current) => (current ?? []).filter((c) => c.id !== client.id));
          message.success('Cliente excluído');
        } catch (error) {
          if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível excluir: ${errorMessage(error)}`);
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

  const filtering = search.trim() !== '' || status !== 'all' || regime !== undefined;
  const value = (n: number | string) => (clients ? n : '—');

  return (
    <Page
      icon={<TeamOutlined />}
      title="Clientes"
      description="Cadastre e acompanhe os clientes para quem você presta serviço."
      actions={
        <NewButton type="primary" size="large" icon={<PlusOutlined />} onClick={() => setEditing('new')} disabled={loadError}>
          Novo Cliente
        </NewButton>
      }
    >
      {loadError && <Alert type="error" showIcon message="Não foi possível carregar os clientes do servidor. Recarregue a página em instantes." />}

      <StatsRow>
        <StatCard
          icon={<TeamOutlined />}
          iconTone="blue"
          label="Total de Clientes"
          value={value(stats.total)}
          onClick={() => setStatus('all')}
          ariaLabel="Mostrar todos os clientes"
        />
        <StatCard
          icon={<CheckCircleOutlined />}
          iconTone="green"
          label="Ativos"
          value={value(stats.active)}
          onClick={() => setStatus('ativo')}
          ariaLabel="Mostrar clientes ativos"
        />
        <StatCard
          icon={<PauseCircleOutlined />}
          iconTone="gray"
          label="Inativos"
          value={value(stats.inactive)}
          onClick={() => setStatus('inativo')}
          ariaLabel="Mostrar clientes inativos"
        />
        <StatCard icon={<DollarOutlined />} iconTone="purple" label="Honorários Mensais" value={value(formatMoney(stats.fees))} small hint="soma dos clientes ativos" />
      </StatsRow>

      <SectionCard
        title={
          <CardTitle>
            <TeamOutlined /> Meus Clientes
          </CardTitle>
        }
        extra={
          <Flex gap={10} align="center" wrap>
            {search.trim() && (
              <Tag icon={<SearchOutlined />} closable onClose={clearSearch} aria-label={`Busca por ${search}. Remover busca`}>
                “{search.trim()}”
              </Tag>
            )}
            <Segmented<StatusFilter>
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'ativo', label: 'Ativos' },
                { value: 'inativo', label: 'Inativos' },
              ]}
            />
            <RegimeSelect
              allowClear
              placeholder="Regime tributário"
              value={regime}
              onChange={setRegime}
              options={(Object.keys(REGIMES) as Regime[]).map((key) => ({ value: key, label: REGIMES[key] }))}
            />
          </Flex>
        }
        flush
      >
        {clients === null ? (
          <LoadingState rows={5} />
        ) : (
          <ClientsTable
            clients={visible}
            onEdit={setEditing}
            onDelete={confirmDelete}
            emptyText={filtering && list.length ? 'Nenhum cliente corresponde à busca e aos filtros.' : 'Nenhum cliente ainda. Clique em "Novo Cliente" para cadastrar o primeiro.'}
          />
        )}
      </SectionCard>

      <ClientFormModal open={editing !== null} client={editing === 'new' ? null : editing} saving={saving} onSave={save} onCancel={() => setEditing(null)} />
    </Page>
  );
}
