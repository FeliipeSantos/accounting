import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  ExportOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Alert, App, Button, DatePicker, Dropdown, Flex, Modal, Segmented, Table, Tag, Tooltip } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { EmptyState, ErrorState, LoadingState, SectionCard, StatCard, StatusBadge } from '@/core/ui';
import { CLIENTS_PATH, formatDocument, formatMoney } from '@/modules/clients/format';
import { dasApi } from '@/modules/das/api';
import { GenerateSteps } from '@/modules/das/components/GenerateSteps';
import { GuideCell } from '@/modules/das/components/GuideCell';
import { copyText, defaultPeriod, formatBarcodeLine, matchesGuide, formatDay, GUIDE_STATUS, isOverdue, PGMEI_URL, periodLabel, shiftPeriod } from '@/modules/das/format';
import type { DasItem, DasListing, GuideStatus } from '@/modules/das/types';
import { colors } from '@/theme';

type Filter = 'all' | GuideStatus;

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

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: ${colors.navy};

  small {
    font-size: 13px;
    font-weight: 500;
    color: ${colors.textMuted};
  }
`;

const ModalTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;

  .anticon {
    font-size: 20px;
    color: ${colors.orange};
  }
`;

const MonthPicker = styled(DatePicker)`
  width: 170px;
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

const Mono = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const StyledTable = styled(Table<DasItem>)`
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

const MOVES: { status: GuideStatus; label: string }[] = [
  { status: 'gerada', label: 'Marcar como gerada' },
  { status: 'paga', label: 'Marcar como paga' },
  { status: 'pendente', label: 'Voltar para pendente' },
];

export function DasPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const [params, setParams] = useSearchParams();
  const search = params.get('q') ?? '';
  const [period, setPeriod] = useState(defaultPeriod);
  const [listing, setListing] = useState<DasListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [reloadKey, setReloadKey] = useState(0);
  // cliente cuja guia está sendo emitida no PGMEI (janela "Gerar" aberta)
  const [generating, setGenerating] = useState<{ item: DasItem; cnpj: string; copied: boolean } | null>(null);
  const today = useMemo(() => dayjs(), []);

  useEffect(() => {
    let active = true;
    setListing(null);
    setError(null);
    dasApi
      .list(period)
      .then((data) => active && setListing(data))
      .catch((err) => active && !(err instanceof SessionExpiredError) && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [period, reloadKey]);

  const items = useMemo(() => listing?.items ?? [], [listing]);
  const counts = useMemo(() => {
    const result = { all: items.length, pendente: 0, gerada: 0, paga: 0, overdue: 0 };
    items.forEach((item) => {
      result[item.status] += 1;
      if (listing && isOverdue(item, listing.dueDate, today)) result.overdue += 1;
    });
    return result;
  }, [items, listing, today]);

  const visible = useMemo(() => items.filter((item) => (filter === 'all' || item.status === filter) && matchesGuide(item, search)), [items, filter, search]);

  function replaceItem(updated: Partial<DasItem> & { clientId: number }) {
    setListing((current) => current && { ...current, items: current.items.map((i) => (i.clientId === updated.clientId ? { ...i, ...updated } : i)) });
  }

  async function saveStatus(item: DasItem, status: GuideStatus) {
    try {
      replaceItem(await dasApi.setStatus(item.clientId, period, status));
      message.success(`${item.name}: ${GUIDE_STATUS[status].label.toLowerCase()}`);
    } catch (err) {
      if (!(err instanceof SessionExpiredError)) message.error(`Não foi possível salvar: ${errorMessage(err)}`);
    }
  }

  function setStatus(item: DasItem, status: GuideStatus) {
    if (status !== 'pendente' || !item.hasPdf) return saveStatus(item, status);
    // voltar para pendente apaga o PDF guardado
    modal.confirm({
      title: 'Voltar para pendente',
      content: `O PDF guardado do DAS de ${item.name} (${periodLabel(period)}) será apagado.`,
      okText: 'Voltar para pendente',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => saveStatus(item, status),
    });
    return undefined;
  }

  /** Sends the guide PDF; resolves true when it was accepted. */
  async function sendPdf(item: DasItem, file: File): Promise<boolean> {
    const key = `das-pdf-${item.clientId}`;
    message.loading({ key, content: `Lendo o PDF do DAS de ${item.name}...`, duration: 0 });
    try {
      const updated = await dasApi.uploadPdf(item.clientId, period, file);
      replaceItem(updated);
      message.success({ key, content: `${item.name}: guia guardada${updated.amount != null ? ` (${formatMoney(updated.amount)})` : ''}` });
      return true;
    } catch (err) {
      if (err instanceof SessionExpiredError) message.destroy(key);
      else message.error({ key, content: `PDF não aceito: ${errorMessage(err)}`, duration: 6 });
      return false;
    }
  }

  async function copyLine(line: string) {
    if (await copyText(line)) message.success('Linha digitável copiada');
    else message.info(formatBarcodeLine(line), 10);
  }

  async function generate(item: DasItem) {
    const cnpj = formatDocument(item.document);
    const copied = await copyText(item.document);
    window.open(PGMEI_URL, '_blank', 'noopener,noreferrer');
    // a janela fica esperando a volta do PGMEI
    setGenerating({ item, cnpj, copied });
  }

  async function markWithoutPdf() {
    if (!generating) return;
    await saveStatus(generating.item, 'gerada');
    setGenerating(null);
  }

  function clearSearch() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('q');
      return next;
    });
  }

  const due = listing ? formatDay(listing.dueDate) : '—';
  const value = (n: number) => (listing ? n : '—');

  return (
    <Page
      icon={<FileDoneOutlined />}
      title="Geração de DAS"
      description="Emita o DAS dos clientes MEI no PGMEI e acompanhe o que já foi gerado e pago em cada mês."
      actions={
        <Flex gap={6} align="center">
          <Button icon={<LeftOutlined />} onClick={() => setPeriod((p) => shiftPeriod(p, -1))} aria-label="Competência anterior" />
          <MonthPicker
            picker="month"
            format="MMMM/YYYY"
            allowClear={false}
            value={dayjs(`${period}-01`)}
            onChange={(value) => value && setPeriod((value as Dayjs).format('YYYY-MM'))}
            aria-label="Competência"
          />
          <Button icon={<RightOutlined />} onClick={() => setPeriod((p) => shiftPeriod(p, 1))} aria-label="Próxima competência" />
        </Flex>
      }
    >
      <Alert
        type="info"
        showIcon
        message="Como funciona"
        description="O PGMEI tem proteção contra robôs, então a guia é emitida por você no site da Receita. Clique em Gerar: o CNPJ é copiado e o PGMEI abre em outra aba. Emita a guia, baixe o PDF e envie-o aqui para guardar o arquivo e ver o valor, o vencimento e a linha digitável. Quando o cliente pagar, marque como paga."
        closable
      />

      <StatsRow>
        <StatCard
          icon={<TeamOutlined />}
          iconTone="blue"
          label="Clientes MEI"
          value={value(counts.all)}
          hint={`Vencimento: ${due}`}
          onClick={() => setFilter('all')}
          ariaLabel="Mostrar todos"
        />
        <StatCard
          icon={<ClockCircleOutlined />}
          iconTone="orange"
          label="Pendentes"
          value={value(counts.pendente)}
          onClick={() => setFilter('pendente')}
          ariaLabel="Mostrar pendentes"
        />
        <StatCard icon={<FileTextOutlined />} iconTone="purple" label="Geradas" value={value(counts.gerada)} onClick={() => setFilter('gerada')} ariaLabel="Mostrar geradas" />
        <StatCard
          icon={<CheckCircleOutlined />}
          iconTone="green"
          label="Pagas"
          value={value(counts.paga)}
          hint={counts.overdue ? `${counts.overdue} vencida${counts.overdue > 1 ? 's' : ''} sem pagamento` : undefined}
          onClick={() => setFilter('paga')}
          ariaLabel="Mostrar pagas"
        />
      </StatsRow>

      <SectionCard
        title={
          <CardTitle>
            <FileDoneOutlined /> Competência {periodLabel(period)}
            <Tooltip title={listing?.dueNote ?? 'Dia 20 do mês seguinte'}>
              <small>vence em {due}</small>
            </Tooltip>
          </CardTitle>
        }
        extra={
          <Flex gap={10} align="center" wrap>
            {search.trim() && (
              <Tag icon={<SearchOutlined />} closable onClose={clearSearch} aria-label={`Busca por ${search}. Remover busca`}>
                “{search.trim()}”
              </Tag>
            )}
            <Segmented<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'pendente', label: 'Pendentes' },
                { value: 'gerada', label: 'Geradas' },
                { value: 'paga', label: 'Pagas' },
              ]}
            />
          </Flex>
        }
        flush
      >
        {error ? (
          <ErrorState message={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : !listing ? (
          <LoadingState rows={4} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<TeamOutlined />}
            title="Nenhum cliente MEI ativo"
            action={
              <Button type="primary" onClick={() => navigate(CLIENTS_PATH)}>
                Abrir Clientes
              </Button>
            }
          >
            Cadastre os clientes com o regime tributário MEI na tela Clientes para gerar o DAS deles aqui.
          </EmptyState>
        ) : (
          <StyledTable
            rowKey="clientId"
            dataSource={visible}
            pagination={false}
            scroll={{ x: 1160 }}
            locale={{ emptyText: 'Nenhum cliente nesta situação.' }}
            columns={[
              {
                title: 'Cliente',
                width: 190,
                key: 'name',
                render: (_, item) => (
                  <div>
                    <Name>{item.name}</Name>
                    {(item.tradeName || item.regime !== 'mei' || item.clientStatus === 'inativo') && (
                      <Sub>{[item.tradeName, item.regime !== 'mei' && 'não é mais MEI', item.clientStatus === 'inativo' && 'inativo'].filter(Boolean).join(' · ')}</Sub>
                    )}
                  </div>
                ),
              },
              { title: 'CNPJ', key: 'document', width: 150, render: (_, item) => <Mono>{formatDocument(item.document)}</Mono> },
              {
                title: 'Situação',
                width: 110,
                key: 'status',
                render: (_, item) => (
                  <Flex gap={6} wrap>
                    <StatusBadge tone={GUIDE_STATUS[item.status].tone}>{GUIDE_STATUS[item.status].label}</StatusBadge>
                    {isOverdue(item, listing.dueDate, today) && <StatusBadge tone="danger">Vencida</StatusBadge>}
                  </Flex>
                ),
              },
              {
                title: 'Guia',
                key: 'guide',
                width: 340,
                render: (_, item) => <GuideCell item={item} period={period} onFile={(file) => sendPdf(item, file)} onCopyLine={copyLine} />,
              },
              {
                title: 'Datas',
                width: 140,
                key: 'dates',
                render: (_, item) =>
                  item.generatedAt ? (
                    <Sub>
                      <div>Gerada em {formatDay(item.generatedAt)}</div>
                      {item.paidAt && <div>Paga em {formatDay(item.paidAt)}</div>}
                    </Sub>
                  ) : (
                    '—'
                  ),
              },
              {
                title: 'Ações',
                key: 'actions',
                align: 'right',
                width: 230,
                render: (_, item) => (
                  <Flex justify="flex-end" gap={6}>
                    <Button type={item.status === 'pendente' ? 'primary' : 'default'} icon={<ExportOutlined />} onClick={() => generate(item)}>
                      {item.status === 'pendente' ? 'Gerar' : 'Gerar de novo'}
                    </Button>
                    <Dropdown
                      trigger={['click']}
                      placement="bottomRight"
                      menu={{
                        items: MOVES.filter((m) => m.status !== item.status).map((m) => ({ key: m.status, label: m.label })),
                        onClick: ({ key }) => setStatus(item, key as GuideStatus),
                      }}
                    >
                      <Button aria-label={`Mudar a situação de ${item.name}`}>
                        Situação <DownOutlined />
                      </Button>
                    </Dropdown>
                  </Flex>
                ),
              },
            ]}
          />
        )}
      </SectionCard>

      <Modal
        open={generating !== null}
        width={520}
        destroyOnHidden
        title={
          generating && (
            <ModalTitle>
              <FileDoneOutlined /> DAS de {generating.item.name}
            </ModalTitle>
          )
        }
        onCancel={() => setGenerating(null)}
        footer={[
          <Button key="later" onClick={() => setGenerating(null)}>
            Ainda não
          </Button>,
          // enviar o PDF é o caminho principal; marcar sem PDF fica como opção secundária
          <Button key="without-pdf" onClick={markWithoutPdf}>
            Marcar gerada sem PDF
          </Button>,
        ]}
      >
        {generating && (
          <GenerateSteps
            cnpj={generating.cnpj}
            period={periodLabel(period)}
            copied={generating.copied}
            onCopy={() => copyText(generating.item.document).then((ok) => (ok ? message.success('CNPJ copiado') : message.info(generating.cnpj, 8)))}
            onFile={(file) => sendPdf(generating.item, file).then((ok) => ok && setGenerating(null))}
          />
        )}
      </Modal>
    </Page>
  );
}
