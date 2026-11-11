import { Alert, App, Button, Flex, Input, Popconfirm, Select, Spin, Tag } from 'antd';
import { Bot, ExternalLink, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import styled from 'styled-components';

import { apiRequest, errorMessage } from '@/core/api/client';
import { useLoad } from '@/core/hooks/useLoad';
import { About, Panel, Row } from '@/core/settings/layout';
import { ErrorState, IconCircle, LoadingState } from '@/core/ui';
import { colors, radius } from '@/theme';

type ProviderId = 'claude' | 'codex';

interface ProviderStatus {
  id: ProviderId;
  name: string;
  /** Plans that work ("Claude Pro ou Max"). */
  plan: string;
  /** The official CLI is on this server. */
  installed: boolean;
  connected: boolean;
  account: string | null;
  error: string | null;
}

interface LoginState {
  provider: ProviderId;
  state: 'starting' | 'waiting' | 'checking' | 'success' | 'failed' | 'canceled';
  url: string | null;
  /** ChatGPT: code typed on the OpenAI page. */
  code: string | null;
  /** Claude: the page shows a code to paste here. */
  needsCode: boolean;
  message: string | null;
}

interface AiStatus {
  activeProvider: ProviderId;
  providers: ProviderStatus[];
  login: LoginState | null;
}

const BASE = '/api/integrations/ai';
const aiApi = {
  status: (fresh = false) => apiRequest<AiStatus>(`${BASE}${fresh ? '?fresh=1' : ''}`),
  choose: (provider: ProviderId) => apiRequest<AiStatus>(`${BASE}/active`, { method: 'PUT', body: { provider } }),
  login: (provider: ProviderId) => apiRequest<AiStatus>(`${BASE}/${provider}/login`, { method: 'POST' }),
  sendCode: (provider: ProviderId, code: string) => apiRequest<AiStatus>(`${BASE}/${provider}/login/code`, { method: 'POST', body: { code } }),
  cancel: (provider: ProviderId) => apiRequest<AiStatus>(`${BASE}/${provider}/login`, { method: 'DELETE' }),
  logout: (provider: ProviderId) => apiRequest<AiStatus>(`${BASE}/${provider}/logout`, { method: 'POST' }),
};

const ACTIVE_LOGIN = ['starting', 'waiting', 'checking'];
const POLL_MS = 2000;

const Side = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
`;

const TypeSelect = styled(Select)`
  width: 220px;
` as typeof Select;

// quadro: tracejado enquanto não há assinatura conectada, contínuo quando conectada
const Box = styled.div<{ $empty: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 20px;
  border: 1px ${({ $empty }) => ($empty ? 'dashed' : 'solid')} ${colors.borderStrong};
  border-radius: ${radius.card}px;
  background: ${({ $empty }) => ($empty ? 'transparent' : colors.bgSubtle)};
`;

const Line = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${colors.textMuted};
  font-size: 13px;

  svg {
    flex-shrink: 0;
    color: ${colors.textSubtle};
  }

  strong {
    font-weight: 600;
    color: ${colors.navy};
  }
`;

const Steps = styled.ol`
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: ${colors.textDark};

  a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: ${colors.blue};
    word-break: break-all;
  }
`;

const DeviceCode = styled.code`
  display: inline-block;
  margin-top: 4px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid ${colors.borderStrong};
  background: ${colors.bgCard};
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 15px;
  letter-spacing: 0.08em;
  color: ${colors.textDark};
`;

// campo do código do Claude, abaixo do passo
const CodeRow = styled(Flex)`
  margin-top: 6px;

  .ant-input {
    flex: 1;
    min-width: 220px;
  }
`;

const Hint = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${colors.textSubtle};
`;

function LoginSteps({ provider, login, onStatus }: { provider: ProviderStatus; login: LoginState; onStatus: (s: AiStatus) => void }) {
  const { message } = App.useApp();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      onStatus(await aiApi.sendCode(provider.id, code));
      setCode('');
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  async function cancel() {
    try {
      onStatus(await aiApi.cancel(provider.id));
    } catch (error) {
      message.error(errorMessage(error));
    }
  }

  if (login.state === 'starting' || (login.state === 'waiting' && !login.url)) {
    return (
      <Line>
        <Spin size="small" />
        <span>Abrindo o login do {provider.name}...</span>
      </Line>
    );
  }
  if (login.state === 'checking' || (login.state === 'waiting' && provider.id === 'claude' && !login.needsCode)) {
    return (
      <Line>
        <Spin size="small" />
        <span>{login.message ?? 'Conferindo o login...'}</span>
      </Line>
    );
  }

  return (
    <>
      <Steps>
        <li>
          Abra a página oficial e entre na sua conta {provider.name}:
          <br />
          <a href={login.url ?? '#'} target="_blank" rel="noopener noreferrer">
            {login.url}
            <ExternalLink size={12} aria-hidden />
          </a>
        </li>
        {provider.id === 'codex' ? (
          <li>
            Digite este código na página (vale 15 minutos):
            <br />
            <DeviceCode>{login.code}</DeviceCode>
          </li>
        ) : (
          <li>
            Copie o código que a página mostra no fim e cole aqui:
            <CodeRow gap={8} wrap>
              <Input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="Código do login"
                aria-label="Código do login do Claude"
                autoComplete="off"
                maxLength={512}
                onPressEnter={() => code.trim() && void send()}
              />
              <Button type="primary" onClick={() => void send()} loading={sending} disabled={!code.trim()}>
                Enviar código
              </Button>
            </CodeRow>
          </li>
        )}
      </Steps>
      {provider.id === 'codex' && <Hint>Se a página recusar o código, ative o login por código de dispositivo nas configurações de segurança do ChatGPT.</Hint>}
      <Flex gap={8} align="center">
        {provider.id === 'codex' && (
          <Line>
            <Spin size="small" />
            <span>Esperando você concluir na página...</span>
          </Line>
        )}
        <Button onClick={() => void cancel()}>Cancelar</Button>
      </Flex>
    </>
  );
}

/** "Assistente de IA" row: the AI in use and the person's own subscription, connected by the official login. */
function AiAssistant() {
  const { message } = App.useApp();
  const loaded = useLoad(() => aiApi.status(), []);
  const [busy, setBusy] = useState<'login' | 'logout' | 'check' | 'choose' | null>(null);

  const status = loaded.data;
  const current = status?.providers.find((p) => p.id === status.activeProvider) ?? null;
  const login = status?.login && current && status.login.provider === current.id ? status.login : null;
  const loginRunning = !!login && ACTIVE_LOGIN.includes(login.state);
  const setStatus = (next: AiStatus) => loaded.setData(() => next);

  // enquanto o login está aberto, acompanha até concluir
  useEffect(() => {
    if (!loginRunning) return undefined;
    const timer = window.setInterval(() => {
      aiApi
        .status()
        .then((next) => {
          loaded.setData(() => next);
          if (next.login?.state === 'success') message.success(next.login.message ?? 'Assinatura conectada.');
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao login em andamento
  }, [loginRunning]);

  async function run(kind: 'login' | 'logout' | 'check' | 'choose', action: () => Promise<AiStatus>, done?: string) {
    setBusy(kind);
    try {
      setStatus(await action());
      if (done) message.success(done);
    } catch (error) {
      message.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Row>
      <About>
        <IconCircle $tone="purple" $size={36} aria-hidden>
          <Sparkles size={16} strokeWidth={2} />
        </IconCircle>
        <div>
          <h2>Assistente de IA</h2>
          <p>
            Conecte a sua própria assinatura do Claude (Pro ou Max) ou do ChatGPT (Plus ou Pro). O uso conta no limite do seu plano, nada é cobrado à parte, e o
            login é feito na página oficial de cada serviço.
          </p>
        </div>
      </About>
      {loaded.error ? (
        <ErrorState message={loaded.error} onRetry={loaded.reload} />
      ) : !status || !current ? (
        <LoadingState rows={2} />
      ) : (
        <Side>
          <TypeSelect
            value={current.id}
            aria-label="Tipo de IA"
            loading={busy === 'choose'}
            disabled={loginRunning}
            options={status.providers.map((p) => ({ value: p.id, label: p.name }))}
            onChange={(value) => void run('choose', () => aiApi.choose(value as ProviderId))}
          />
          <Box $empty={!current.connected}>
            {!current.installed ? (
              <Line>
                <Bot size={18} aria-hidden />
                <span>
                  A ferramenta oficial do {current.name} não está instalada neste servidor. Na instalação com Docker ela já vem pronta (veja o DOCKER.md).
                </span>
              </Line>
            ) : login && login.state !== 'success' && login.state !== 'canceled' && (loginRunning || login.state === 'failed') ? (
              loginRunning ? (
                <LoginSteps provider={current} login={login} onStatus={setStatus} />
              ) : (
                <>
                  <Alert type="error" showIcon message={login.message ?? 'O login não foi concluído.'} />
                  <Flex gap={8}>
                    <Button type="primary" onClick={() => void run('login', () => aiApi.login(current.id))} loading={busy === 'login'}>
                      Tentar de novo
                    </Button>
                  </Flex>
                </>
              )
            ) : current.connected ? (
              <>
                <Line>
                  <strong>{current.name}</strong>
                  <Tag color="green">Conectado</Tag>
                  {current.account && <span>{current.account}</span>}
                </Line>
                <Flex gap={8} wrap>
                  <Button onClick={() => void run('check', () => aiApi.status(true), 'Conexão conferida.')} loading={busy === 'check'}>
                    Verificar conexão
                  </Button>
                  <Popconfirm
                    title="Desconectar a assinatura?"
                    description="O login sai deste servidor. Os resumos já gerados continuam salvos."
                    okText="Desconectar"
                    okButtonProps={{ danger: true }}
                    cancelText="Cancelar"
                    onConfirm={() => void run('logout', () => aiApi.logout(current.id), 'Assinatura desconectada.')}
                  >
                    <Button danger loading={busy === 'logout'}>
                      Desconectar
                    </Button>
                  </Popconfirm>
                </Flex>
              </>
            ) : (
              <>
                <Line>
                  <Bot size={18} aria-hidden />
                  <span>A IA não está conectada. Funciona com a assinatura {current.plan}.</span>
                </Line>
                {current.error && <Alert type="warning" showIcon message={current.error} />}
                <Flex>
                  <Button type="primary" onClick={() => void run('login', () => aiApi.login(current.id))} loading={busy === 'login'}>
                    Conectar assinatura do {current.name}
                  </Button>
                </Flex>
              </>
            )}
          </Box>
          <Hint>
            Use só a sua própria assinatura. O opencontabil não vê nem guarda a sua senha: o login fica com a ferramenta oficial do serviço, neste servidor.
          </Hint>
        </Side>
      )}
    </Row>
  );
}

/** "Integrações" tab of Ajustes: external services used by the installation. */
export function IntegrationsSettings() {
  return (
    <Panel aria-label="Integrações">
      <AiAssistant />
    </Panel>
  );
}
