import { App, Button, Checkbox, Col, Flex, Form, Row, Table, TimePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { useLoad } from '@/core/hooks/useLoad';
import { ErrorState, LoadingState, SectionCard, StatusBadge, TableFrame } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDateTime, METHOD_LABELS, nextRunText } from '@/modules/intelligence/format';
import type { RunState, Settings, Source, Subject } from '@/modules/intelligence/types';

interface SettingsData {
  settings: Settings;
  sources: Source[];
  subjects: Subject[];
  rules: string[];
  status: RunState;
}

// o grupo de caixas ocupa a largura disponível: a tabela de fontes rola dentro dele
const FullWidthGroup = styled(Checkbox.Group)`
  display: block;
  width: 100%;
  min-width: 0;
`;

const RuleList = styled.ul`
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

interface FormValues {
  runTime: Dayjs;
  enabledSources: string[];
  enabledSubjects: string[];
}

async function loadSettings(): Promise<SettingsData> {
  const [settings, sources, subjects, rules, status] = await Promise.all([
    intelligenceApi.settings(),
    intelligenceApi.sources(),
    intelligenceApi.subjects(),
    intelligenceApi.rules(),
    intelligenceApi.status(),
  ]);
  return { settings, sources, subjects, rules, status };
}

function SettingsForm({ data, onSaved }: { data: SettingsData; onSaved: () => void }) {
  const { message } = App.useApp();
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);

  async function save(values: FormValues) {
    // evita envio duplicado enquanto o anterior não terminou
    if (saving) return;
    setSaving(true);
    try {
      await intelligenceApi.saveSettings({
        runTime: values.runTime.format('HH:mm'),
        enabledSources: values.enabledSources,
        enabledSubjects: values.enabledSubjects,
      });
      message.success('Configurações salvas.');
      onSaved();
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Erro: ${errorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Form<FormValues>
      form={form}
      layout="vertical"
      onFinish={save}
      initialValues={{
        runTime: dayjs(data.settings.runTime, 'HH:mm'),
        enabledSources: data.settings.enabledSources,
        enabledSubjects: data.settings.enabledSubjects,
      }}
    >
      <Flex vertical gap={16}>
        <SectionCard title="Execução diária">
          <Form.Item label="Horário do monitoramento" name="runTime" rules={[{ required: true, message: 'Informe o horário' }]}>
            <TimePicker format="HH:mm" allowClear={false} />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            A coleta roda no servidor uma vez por dia neste horário, mesmo sem usuários conectados. Se o servidor estiver desligado no horário, a coleta
            acontece assim que ele for ligado. Se todas as fontes falharem, ela é repetida a cada hora (até 3 tentativas no dia).
          </Typography.Paragraph>
          <Typography.Text type="secondary">{nextRunText(data.status)}</Typography.Text>
        </SectionCard>

        <SectionCard title="Fontes monitoradas">
          <Form.Item name="enabledSources" noStyle>
            <FullWidthGroup>
              <TableFrame>
                <Table<Source>
                  rowKey="id"
                  pagination={false}
                  scroll={{ x: 'max-content' }}
                  dataSource={data.sources}
                  columns={[
                    {
                      title: 'Ativa',
                      key: 'enabled',
                      render: (_, s) => <Checkbox value={s.id} disabled={!s.collectable} aria-label={`Monitorar ${s.name}`} />,
                    },
                    {
                      title: 'Fonte',
                      key: 'name',
                      render: (_, s) => (
                        <>
                          <Typography.Text strong>{s.name}</Typography.Text>
                          <br />
                          <Typography.Text type="secondary">{s.coverage}</Typography.Text>
                        </>
                      ),
                    },
                    {
                      title: 'Coleta',
                      key: 'method',
                      render: (_, s) =>
                        s.collectable ? (
                          <StatusBadge tone="success">{METHOD_LABELS[s.method] ?? 'Coleta direta'}</StatusBadge>
                        ) : (
                          <StatusBadge tone="danger">Indisponível</StatusBadge>
                        ),
                    },
                    { title: 'Último sucesso', key: 'success', render: (_, s) => (s.status?.lastSuccessAt ? formatDateTime(s.status.lastSuccessAt) : '—') },
                    { title: 'Último erro', key: 'error', render: (_, s) => <Typography.Text type="secondary">{s.status?.lastError || '—'}</Typography.Text> },
                  ]}
                />
              </TableFrame>
            </FullWidthGroup>
          </Form.Item>
        </SectionCard>

        <SectionCard title="Assuntos monitorados">
          <Form.Item name="enabledSubjects" noStyle>
            <FullWidthGroup>
              <Row gutter={[16, 8]}>
                {data.subjects.map((s) => (
                  <Col key={s.id} xs={24} sm={12} lg={8}>
                    <Checkbox value={s.id}>{s.name}</Checkbox>
                  </Col>
                ))}
              </Row>
            </FullWidthGroup>
          </Form.Item>
        </SectionCard>

        <SectionCard title="Regras de classificação">
          <RuleList>
            {data.rules.map((rule) => (
              <li key={rule}>
                <Typography.Text>{rule}</Typography.Text>
              </li>
            ))}
          </RuleList>
        </SectionCard>

        <Flex>
          <Button type="primary" htmlType="submit" loading={saving}>
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </Flex>
      </Flex>
    </Form>
  );
}

export function SettingsView() {
  const { refreshKey, reloadCatalog } = useIntelligence();
  const state = useLoad(loadSettings, [refreshKey]);

  if (state.error) return <ErrorState message={state.error} onRetry={state.reload} />;
  if (!state.data) return <LoadingState rows={8} />;
  return (
    <SettingsForm
      data={state.data}
      onSaved={() => {
        void reloadCatalog();
        state.reload();
      }}
    />
  );
}
