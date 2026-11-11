import { Button, Flex, Modal, Skeleton, Tabs } from 'antd';
import { Fragment, useEffect, useState } from 'react';
import styled, { createGlobalStyle } from 'styled-components';

import { Chip } from '@/core/ui';
import { intelligenceApi } from '@/modules/intelligence/api';
import { AiSummaryTab } from '@/modules/intelligence/components/AiSummaryTab';
import { FavoriteButton, RelevanceBadge } from '@/modules/intelligence/components/PublicationParts';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDate, formatDateTime, formatPublished, RELEVANCE, relevanceSteps, safeOfficialUrl } from '@/modules/intelligence/format';
import { splitHighlights, summarizePublication } from '@/modules/intelligence/summary';
import type { FullText, KeyPoint, Publication } from '@/modules/intelligence/types';
import { colors, fontSize, radius, tones } from '@/theme';

const ROOT_CLASS = 'intelligence-detail';

// o modal é renderizado fora da página (portal): some na impressão como a tela do módulo
const DetailPrintStyle = createGlobalStyle`
  @media print {
    .${ROOT_CLASS} {
      display: none !important;
    }
  }
`;

const Meta = styled.span`
  font-size: ${fontSize.label}px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${colors.textSubtle};
`;

const Title = styled.h3`
  margin: 0;
  font-size: ${fontSize.section}px;
  font-weight: 600;
  color: ${colors.navy};
  line-height: 1.35;
  overflow-wrap: anywhere;
`;

const Fields = styled.dl`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px 16px;
  margin: 0;

  dt {
    font-size: ${fontSize.label}px;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: ${colors.textSubtle};
    margin-bottom: 2px;
  }

  dd {
    margin: 0;
    font-size: ${fontSize.support}px;
    color: ${colors.textDark};
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const SectionTitle = styled.h4`
  margin: 0 0 8px;
  font-size: ${fontSize.support}px;
  font-weight: 600;
  color: ${colors.navy};
`;

const ReasonBox = styled.div`
  background: ${colors.bgSubtle};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  padding: 14px 16px;
`;

const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-left: 20px;
  margin: 0 0 10px;
  font-size: ${fontSize.support}px;
  color: ${colors.textDark};
`;

const Muted = styled.p`
  margin: 0;
  font-size: 12px;
  color: ${colors.textMuted};
`;

const ScaleNote = styled(Muted)`
  margin-bottom: 10px;
`;

const SubjectSteps = styled(Steps)`
  margin-bottom: 0;
`;

// mantém as quebras de linha do texto oficial
const OfficialText = styled.div`
  max-height: 52vh;
  overflow-y: auto;
  padding: 14px 16px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgSubtle};
  font-size: ${fontSize.support}px;
  line-height: 1.6;
  white-space: pre-line;
  overflow-wrap: anywhere;
  color: ${colors.textDark};
`;

const SummaryBox = styled.div`
  background: ${tones.info.bg};
  border: 1px solid ${tones.info.border};
  border-radius: ${radius.card}px;
  padding: 14px 16px;
`;

const Headline = styled.p`
  margin: 0;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.5;
  color: ${colors.navy};
  overflow-wrap: anywhere;
`;

const Goals = styled.ul`
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 0;
  padding-left: 20px;
  font-size: ${fontSize.support}px;
  line-height: 1.5;
  color: ${colors.textDark};
`;

const Points = styled.ol`
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Point = styled.li`
  padding: 10px 12px;
  border: 1px solid ${colors.border};
  border-left: 3px solid ${tones.info.solid};
  border-radius: ${radius.card}px;
  background: ${colors.bgCard};
`;

const PointRef = styled.div`
  margin-bottom: 4px;
  font-size: ${fontSize.label}px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: ${colors.textSubtle};
`;

const PointText = styled.p`
  margin: 0;
  font-size: ${fontSize.support}px;
  line-height: 1.55;
  color: ${colors.textDark};
  overflow-wrap: anywhere;

  strong {
    font-weight: 600;
    color: ${colors.navy};
    background: ${tones.warning.bg};
    border-radius: 3px;
    padding: 0 2px;
  }
`;

const EffectiveBox = styled.div`
  padding: 10px 12px;
  border: 1px solid ${tones.success.border};
  border-radius: ${radius.card}px;
  background: ${tones.success.bg};
`;

const EffectiveItems = styled.ul`
  margin: 6px 0 0;
  padding-left: 20px;
  font-size: ${fontSize.support}px;
  line-height: 1.5;
  color: ${colors.textDark};
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: 130px 1fr;
  gap: 8px 12px;
  margin: 0;
  font-size: ${fontSize.support}px;

  dt {
    color: ${colors.textMuted};
  }

  dd {
    margin: 0;
    color: ${colors.textDark};
    overflow-wrap: anywhere;
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
    gap: 2px 0;

    dd {
      margin-bottom: 6px;
    }
  }
`;

const MetaLine = styled.p`
  margin: 0;
  padding-top: 12px;
  border-top: 1px solid ${colors.border};
  font-size: 12px;
  color: ${colors.textMuted};
`;

const Disclaimer = styled.p`
  margin: 0;
  font-size: ${fontSize.label}px;
  color: ${colors.textSubtle};
  text-align: left;
`;

// título e explicação da lista, conforme o que o texto do ato permitiu extrair
const POINTS_HEADING: Record<'values' | 'provisions' | 'fields', { title: string; note: string }> = {
  values: {
    title: 'Pontos principais do texto',
    note: 'Dispositivos com valores, percentuais, prazos e datas, extraídos automaticamente por regras do texto oficial.',
  },
  provisions: {
    title: 'Principais dispositivos',
    note: 'O texto não traz valores, percentuais ou prazos; estes são os dispositivos do ato, extraídos automaticamente por regras.',
  },
  fields: {
    title: 'Dados principais',
    note: 'Campos do texto oficial (assunto, mercadoria, código NCM...), extraídos automaticamente por regras.',
  },
};

const FULL_TEXT_NOTE: Record<Exclude<FullText['status'], 'ok'>, string> = {
  pending: 'O texto completo deste ato ainda não foi lido; ele é buscado na próxima coleta.',
  unavailable: 'Esta fonte (notícia, projeto de lei ou portal) não publica o texto completo de um ato; o resumo acima vem só do trecho oficial.',
  error: 'Não foi possível ler o texto completo na fonte oficial; uma nova tentativa é feita na próxima coleta.',
};

interface PublicationDetailProps {
  publication: Publication | null;
  onClose: () => void;
  onChange: (publication: Publication) => void;
}

/** "Por que esta relevância?" and "Por que estes assuntos?" from the stored reason. */
function RelevanceReason({ publication }: { publication: Publication }) {
  const { subjectName } = useIntelligence();
  const steps = relevanceSteps(publication, subjectName);
  const reason = publication.classificationReason;
  if (!steps || !reason) {
    return <Muted>Critério não registrado para esta publicação (coletada antes desta informação existir).</Muted>;
  }
  return (
    <ReasonBox>
      <SectionTitle>Por que a relevância é &quot;{RELEVANCE[publication.relevance].label}&quot;?</SectionTitle>
      <Steps>
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </Steps>
      <ScaleNote>Escala: 4 ou mais = Crítica · 3 = Alta · 1–2 = Média · 0 = Baixa. Regras completas em Configurações.</ScaleNote>
      <SectionTitle>Por que estes assuntos?</SectionTitle>
      <SubjectSteps as="ul">
        {reason.subjects.map((s) => (
          <li key={s.id}>
            {subjectName(s.id)}:{' '}
            {s.via === 'source' ? 'assunto da própria fonte' : `termo(s) encontrado(s) no texto: ${s.terms.map((t) => `"${t}"`).join(', ')}`}
          </li>
        ))}
      </SubjectSteps>
    </ReasonBox>
  );
}

function Highlighted({ point }: { point: KeyPoint }) {
  return (
    <PointText>
      {splitHighlights(point.text, point.highlights).map((part, index) => (part.strong ? <strong key={index}>{part.text}</strong> : <Fragment key={index}>{part.text}</Fragment>))}
    </PointText>
  );
}

/** Main action (ementa), key points of the full text and key facts. */
function SummaryTab({ publication, fullText }: { publication: Publication; fullText: FullText | null }) {
  const summary = summarizePublication(publication);
  const meta = [publication.publishedAt ? `Publicado em ${formatPublished(publication)}` : null, publication.actType, publication.organ].filter(Boolean);
  const full = fullText?.status === 'ok' ? fullText : null;
  // com o texto completo, a vigência vem do próprio artigo; sem ele, da classificação
  const facts = full?.effective ? summary.facts.filter((fact) => fact.label !== 'Vigência') : summary.facts;

  return (
    <Flex vertical gap={16}>
      <SummaryBox>
        {summary.headline ? (
          <>
            <Headline>{summary.headline}</Headline>
            {summary.goals.length > 0 && (
              <Goals>
                {summary.goals.map((goal) => (
                  <li key={goal}>{goal}</li>
                ))}
              </Goals>
            )}
          </>
        ) : (
          <Muted>A fonte não trouxe ementa para resumir.</Muted>
        )}
      </SummaryBox>

      {fullText === null ? (
        <Skeleton active paragraph={{ rows: 4 }} title={false} />
      ) : fullText.status !== 'ok' ? (
        <Muted>{FULL_TEXT_NOTE[fullText.status]}</Muted>
      ) : (
        <>
          <div>
            <SectionTitle>{POINTS_HEADING[fullText.basis ?? 'values'].title}</SectionTitle>
            {fullText.points.length ? (
              <Points>
                {fullText.points.map((point) => (
                  <Point key={`${point.ref}|${point.text}`}>
                    <PointRef>{point.ref}</PointRef>
                    <Highlighted point={point} />
                  </Point>
                ))}
              </Points>
            ) : (
              <Muted>O texto não traz valores, percentuais ou prazos explícitos. Veja o texto completo na aba Texto oficial.</Muted>
            )}
          </div>
          {fullText.effective && (
            <EffectiveBox>
              <PointRef>Vigência · {fullText.effective.ref}</PointRef>
              <PointText>{fullText.effective.text}</PointText>
              {fullText.effective.items.length > 0 && (
                <EffectiveItems>
                  {fullText.effective.items.map((entry) => (
                    <li key={entry}>{entry}</li>
                  ))}
                </EffectiveItems>
              )}
            </EffectiveBox>
          )}
        </>
      )}

      {facts.length > 0 && (
        <Facts>
          {facts.map((fact) => (
            <Fragment key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </Fragment>
          ))}
        </Facts>
      )}
      {meta.length > 0 && <MetaLine>{meta.join(' · ')}</MetaLine>}
      <Muted>
        {full
          ? `${POINTS_HEADING[full.basis ?? 'values'].note} Confira sempre o texto oficial.`
          : 'Resumo montado automaticamente por regras a partir do trecho oficial. Confira sempre o texto oficial.'}
      </Muted>
    </Flex>
  );
}

function OfficialTextTab({ publication, fullText }: { publication: Publication; fullText: FullText | null }) {
  if (fullText?.status === 'ok') {
    return (
      <Flex vertical gap={8}>
        <OfficialText>{fullText.text}</OfficialText>
        <Muted>Texto completo do ato, como publicado na fonte oficial.</Muted>
      </Flex>
    );
  }
  if (!publication.excerpt) return <Muted>A fonte não trouxe trecho oficial para esta publicação.</Muted>;
  return (
    <Flex vertical gap={8}>
      <OfficialText>{publication.excerpt}</OfficialText>
      <Muted>Trecho como publicado pela fonte; o ato completo está na fonte oficial.</Muted>
    </Flex>
  );
}

function ClassificationTab({ publication }: { publication: Publication }) {
  const fields = [
    {
      label: 'Data de publicação',
      value: publication.publishedAt ? formatPublished(publication) : 'Não informada pela fonte',
    },
    { label: 'Tipo de ato', value: publication.actType },
    { label: 'Classificação', value: publication.normType },
    { label: 'Vigência', value: publication.effectiveDate ? formatDate(publication.effectiveDate) : null },
    { label: 'Órgão', value: publication.organ },
    { label: 'Coletado em', value: formatDateTime(publication.collectedAt) },
  ].filter((field) => field.value);

  return (
    <Flex vertical gap={16}>
      <Fields>
        {fields.map((field) => (
          <div key={field.label}>
            <dt>{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </Fields>
      <RelevanceReason publication={publication} />
    </Flex>
  );
}

/** Full text of the open publication, loaded when it opens (null while loading). */
function useFullText(publicationId: string | null): FullText | null {
  const [loaded, setLoaded] = useState<{ id: string; fullText: FullText } | null>(null);

  useEffect(() => {
    if (!publicationId) return undefined;
    const controller = new AbortController();
    intelligenceApi
      .publication(publicationId, controller.signal)
      .then((data) => setLoaded({ id: publicationId, fullText: data.fullText ?? { status: 'pending' } }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setLoaded({ id: publicationId, fullText: { status: 'error' } });
      });
    return () => controller.abort();
  }, [publicationId]);

  return loaded && loaded.id === publicationId ? loaded.fullText : null;
}

export function PublicationDetail({ publication, onClose, onChange }: PublicationDetailProps) {
  const { sourceName, subjectName } = useIntelligence();
  const href = publication ? safeOfficialUrl(publication.url) : null;
  const fullText = useFullText(publication?.id ?? null);

  return (
    <>
      <DetailPrintStyle />
      <Modal
        open={publication !== null}
        onCancel={onClose}
        centered
        width={760}
        rootClassName={ROOT_CLASS}
        title={publication ? <Meta>{sourceName(publication.sourceId)}</Meta> : null}
        styles={{ body: { maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: 4 } }}
        destroyOnHidden
        footer={
          publication ? (
            <Flex vertical gap={8}>
              <Flex gap={10} align="center">
                {href && (
                  <Button type="primary" href={href} target="_blank" rel="noopener noreferrer">
                    Abrir fonte oficial ↗
                  </Button>
                )}
                <FavoriteButton publication={publication} onChange={onChange} />
              </Flex>
              <Disclaimer>Conteúdo reproduzido da fonte oficial. Não constitui parecer jurídico ou contábil.</Disclaimer>
            </Flex>
          ) : null
        }
      >
        {publication && (
          <Flex vertical gap={12}>
            <Title>{publication.title}</Title>
            <Flex wrap gap={6} align="center">
              {RELEVANCE[publication.relevance] && <RelevanceBadge relevance={publication.relevance} />}
              {publication.subjects.map((id) => (
                <Chip key={id}>{subjectName(id)}</Chip>
              ))}
            </Flex>
            <Tabs
              key={publication.id}
              defaultActiveKey="summary"
              items={[
                { key: 'summary', label: 'Resumo', children: <SummaryTab publication={publication} fullText={fullText} /> },
                // só busca (e só gera, se pedido) quando a aba é aberta
                { key: 'ai', label: 'Resumo IA', children: <AiSummaryTab publicationId={publication.id} /> },
                { key: 'official', label: 'Texto oficial', children: <OfficialTextTab publication={publication} fullText={fullText} /> },
                { key: 'classification', label: 'Classificação', children: <ClassificationTab publication={publication} /> },
              ]}
            />
          </Flex>
        )}
      </Modal>
    </>
  );
}
