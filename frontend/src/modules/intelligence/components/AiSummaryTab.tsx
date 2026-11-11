import { Alert, Button, Flex, Spin, Tag, Tooltip } from 'antd';
import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import { apiRequest, errorMessage } from '@/core/api/client';
import { SETTINGS_PATH } from '@/core/settings/routes';
import { formatDate, formatDateTime } from '@/modules/intelligence/format';
import { colors, fontSize, radius } from '@/theme';

interface AiPoint {
  texto: string;
  /** "fonte": written in the official text (with the exact excerpt); "contexto": general knowledge of the AI. */
  origem: 'fonte' | 'contexto';
  trecho: string;
}

interface AiDeadline {
  data: string;
  descricao: string;
  origem: 'fonte' | 'contexto';
  trecho: string;
}

interface AiSummary {
  tipo: 'norma' | 'proposta' | 'comunicado' | 'documento_tecnico' | 'outro';
  do_que_se_trata: string;
  quem_e_afetado: AiPoint[];
  quem_nao_e_afetado: AiPoint[];
  o_que_muda: AiPoint[];
  o_que_fazer: AiPoint[];
  prazos: AiDeadline[];
  vigencia: AiPoint | null;
  confianca: 'alta' | 'media' | 'baixa';
  motivo_confianca: string;
  informacoes_faltando: string[];
}

interface AiSummaryState {
  status: 'none' | 'pending' | 'ok' | 'error';
  provider?: string;
  providerName?: string;
  model?: string | null;
  summary?: AiSummary | null;
  partial?: boolean;
  error?: string | null;
  updatedAt?: string;
  /** The official text changed after this summary. */
  outdated?: boolean;
}

const path = (id: string) => `/api/intelligence/publications/${encodeURIComponent(id)}/ai-summary`;
const aiSummaryApi = {
  get: (id: string) => apiRequest<AiSummaryState>(path(id)),
  request: (id: string) => apiRequest<AiSummaryState>(path(id), { method: 'POST' }),
};

const POLL_MS = 3000;

const KIND: Record<AiSummary['tipo'], string> = {
  norma: 'Norma',
  proposta: 'Proposta',
  comunicado: 'Comunicado',
  documento_tecnico: 'Documento técnico',
  outro: 'Outro',
};

const CONFIDENCE: Record<AiSummary['confianca'], { label: string; color: string }> = {
  alta: { label: 'Confiança alta', color: 'green' },
  media: { label: 'Confiança média', color: 'gold' },
  baixa: { label: 'Confiança baixa', color: 'red' },
};

const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 20px;
  border: 1px dashed ${colors.borderStrong};
  border-radius: ${radius.card}px;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

const Lead = styled.p`
  margin: 0;
  padding: 14px 16px;
  border-radius: ${radius.card}px;
  background: ${colors.blueSelected};
  font-size: 14.5px;
  line-height: 1.55;
  color: ${colors.textDark};
`;

const Section = styled.section`
  h4 {
    margin: 0 0 8px;
    font-size: ${fontSize.support}px;
    font-weight: 600;
    color: ${colors.navy};
  }

  ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    font-size: ${fontSize.support}px;
    line-height: 1.55;
    color: ${colors.textDark};
  }
`;

const Origin = styled(Tag)`
  &&& {
    margin-left: 6px;
    font-size: 11px;
    line-height: 18px;
    cursor: default;
  }
`;

const Footer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
  font-size: 12px;
  color: ${colors.textSubtle};
`;

function OriginTag({ point }: { point: { origem: 'fonte' | 'contexto'; trecho: string } }) {
  if (point.origem === 'fonte') {
    return (
      <Tooltip title={`“${point.trecho}”`}>
        <Origin color="blue">Do texto oficial</Origin>
      </Tooltip>
    );
  }
  return (
    <Tooltip title="Conhecimento geral da IA, não está no texto da publicação. Confira antes de usar.">
      <Origin>Contexto da IA</Origin>
    </Tooltip>
  );
}

function Points({ title, points }: { title: string; points: AiPoint[] }) {
  if (!points.length) return null;
  return (
    <Section>
      <h4>{title}</h4>
      <ul>
        {points.map((point, index) => (
          <li key={index}>
            {point.texto}
            <OriginTag point={point} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function SummaryView({ state }: { state: AiSummaryState & { summary: AiSummary } }) {
  const { summary } = state;
  const confidence = CONFIDENCE[summary.confianca];
  return (
    <Box>
      <Flex gap={6} wrap>
        <Tag>{KIND[summary.tipo]}</Tag>
        <Tag color={confidence.color}>{confidence.label}</Tag>
      </Flex>
      {summary.do_que_se_trata && <Lead>{summary.do_que_se_trata}</Lead>}
      {state.outdated && <Alert type="warning" showIcon message="O texto da publicação mudou depois deste resumo. Gere de novo para atualizar." />}
      {state.partial && <Alert type="info" showIcon message="O ato é muito longo: a IA recebeu só a primeira parte do texto oficial." />}
      <Points title="Quem é afetado" points={summary.quem_e_afetado} />
      <Points title="Quem não é afetado" points={summary.quem_nao_e_afetado} />
      <Points title="O que muda" points={summary.o_que_muda} />
      <Points title="O que fazer" points={summary.o_que_fazer} />
      {summary.prazos.length > 0 && (
        <Section>
          <h4>Prazos</h4>
          <ul>
            {summary.prazos.map((deadline, index) => (
              <li key={index}>
                {deadline.data && <strong>{formatDate(deadline.data)}: </strong>}
                {deadline.descricao}
                <OriginTag point={deadline} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {summary.vigencia && (
        <Section>
          <h4>Vigência</h4>
          <ul>
            <li>
              {summary.vigencia.texto}
              <OriginTag point={summary.vigencia} />
            </li>
          </ul>
        </Section>
      )}
      {summary.informacoes_faltando.length > 0 && (
        <Section>
          <h4>O que o texto não informa</h4>
          <ul>
            {summary.informacoes_faltando.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </Section>
      )}
      <Footer>
        {summary.motivo_confianca && <span>{summary.motivo_confianca}</span>}
        <span>
          Gerado pelo {state.providerName}
          {state.model ? ` (${state.model})` : ''} com a sua assinatura{state.updatedAt ? ` em ${formatDateTime(state.updatedAt)}` : ''}. A IA pode errar: confira
          sempre o texto oficial. Não constitui parecer jurídico ou contábil.
        </span>
      </Footer>
    </Box>
  );
}

/** "Resumo IA" tab: made only when asked, with the subscription chosen in Ajustes > Integrações. */
export function AiSummaryTab({ publicationId }: { publicationId: string }) {
  const [state, setState] = useState<AiSummaryState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(() => {
    setLoadError(null);
    aiSummaryApi
      .get(publicationId)
      .then(setState)
      .catch((error) => setLoadError(errorMessage(error)));
  }, [publicationId]);

  useEffect(load, [load]);

  // pedido em andamento: acompanha até ficar pronto
  const pending = state?.status === 'pending';
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => {
      aiSummaryApi
        .get(publicationId)
        .then(setState)
        .catch(() => undefined);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pending, publicationId]);

  async function generate() {
    setRequesting(true);
    setRequestError(null);
    try {
      setState(await aiSummaryApi.request(publicationId));
    } catch (error) {
      setRequestError(errorMessage(error));
    } finally {
      setRequesting(false);
    }
  }

  if (loadError) return <Alert type="error" showIcon message={loadError} action={<Button onClick={load}>Tentar de novo</Button>} />;
  if (!state) return <Spin />;

  const settingsLink = <Link to={`${SETTINGS_PATH}?aba=integracoes`}>Ajustes &gt; Integrações</Link>;
  const requestAlert = requestError && (
    <Alert
      type="warning"
      showIcon
      message={requestError}
      description={requestError.includes('Integrações') || requestError.includes('instalada') ? <>Abra {settingsLink} para conectar a assinatura.</> : undefined}
    />
  );

  if (state.status === 'pending') {
    return (
      <Empty>
        <Flex gap={10} align="center">
          <Spin size="small" />
          <span>{state.providerName ?? 'A IA'} está lendo a publicação. Isso costuma levar menos de um minuto.</span>
        </Flex>
      </Empty>
    );
  }

  if (state.status === 'ok' && state.summary) {
    return (
      <Box>
        <SummaryView state={state as AiSummaryState & { summary: AiSummary }} />
        {requestAlert}
        <Flex>
          <Button onClick={() => void generate()} loading={requesting}>
            Gerar de novo
          </Button>
        </Flex>
      </Box>
    );
  }

  return (
    <Box>
      <Empty>
        <Flex gap={10} align="center">
          <Sparkles size={18} aria-hidden />
          <span>
            {state.status === 'error'
              ? 'Não foi possível gerar o resumo.'
              : 'Peça um resumo desta publicação à IA conectada em Ajustes > Integrações. Ele usa a sua assinatura e fica salvo para as próximas vezes.'}
          </span>
        </Flex>
        {state.status === 'error' && state.error && <Alert type="error" showIcon message={state.error} />}
        <Button type="primary" onClick={() => void generate()} loading={requesting}>
          {state.status === 'error' ? 'Tentar de novo' : 'Gerar resumo com IA'}
        </Button>
      </Empty>
      {requestAlert}
    </Box>
  );
}
