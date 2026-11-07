import { App, Button, Card, Checkbox, Col, Flex, Form, Row, Table, Tag, TimePicker, Typography } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { useLoad } from '@/core/hooks/useLoad';
import { intelligenceApi } from '@/modules/intelligence/api';
import { ViewState } from '@/modules/intelligence/components/ViewState';
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

  async function save(values: FormValues) {
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
        <Card title="Execução diária">
          <Form.Item label="Horário do monitoramento" name="runTime" rules={[{ required: true, message: 'Informe o horário' }]}>
            <TimePicker format="HH:mm" minuteStep={5} allowClear={false} />
          </Form.Item>
          <Typography.Paragraph type="secondary">
            A coleta roda no servidor uma vez por dia neste horário, mesmo sem usuários conectados. Se o servidor estiver desligado no horário, a coleta
            acontece assim que ele for ligado. Se todas as fontes falharem, ela é repetida a cada hora (até 3 tentativas no dia).
          </Typography.Paragraph>
          <Typography.Text type="secondary">{nextRunText(data.status)}</Typography.Text>
        </Card>

        <Card title="Fontes monitoradas">
          <Form.Item name="enabledSources" noStyle>
            <FullWidthGroup>
              <Table<Source>
                rowKey="id"
                size="small"
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
                    render: (_, s) => (s.collectable ? <Tag color="green">{METHOD_LABELS[s.method] ?? 'Coleta direta'}</Tag> : <Tag color="red">Indisponível</Tag>),
                  },
                  { title: 'Último sucesso', key: 'success', render: (_, s) => (s.status?.lastSuccessAt ? formatDateTime(s.status.lastSuccessAt) : '—') },
                  { title: 'Último erro', key: 'error', render: (_, s) => <Typography.Text type="secondary">{s.status?.lastError || '—'}</Typography.Text> },
                ]}
              />
            </FullWidthGroup>
          </Form.Item>
        </Card>

        <Card title="Assuntos monitorados">
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
        </Card>

        <Card title="Regras de classificação">
          <ul>
            {data.rules.map((rule) => (
              <li key={rule}>
                <Typography.Text>{rule}</Typography.Text>
              </li>
            ))}
          </ul>
        </Card>

        <Flex>
          <Button type="primary" htmlType="submit">
            Salvar configurações
          </Button>
        </Flex>
      </Flex>
    </Form>
  );
}

export function SettingsView() {
  const { refreshKey, reloadCatalog } = useIntelligence();
  const state = useLoad(loadSettings, [refreshKey]);

  return (
    <ViewState state={state}>
      {(data: SettingsData) => (
        <SettingsForm
          data={data}
          onSaved={() => {
            void reloadCatalog();
            state.reload();
          }}
        />
      )}
    </ViewState>
  );
}
