import { Button, Drawer, Flex } from 'antd';
import styled, { createGlobalStyle } from 'styled-components';

import { Chip } from '@/core/ui';
import { FavoriteButton, RelevanceBadge } from '@/modules/intelligence/components/PublicationParts';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDate, formatDateTime, formatPublished, RELEVANCE, relevanceSteps, safeOfficialUrl } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';
import { colors, fontSize, radius } from '@/theme';

const ROOT_CLASS = 'intelligence-detail';

// o painel é renderizado fora da página (portal): some na impressão como a tela do módulo
const DetailPrintStyle = createGlobalStyle`
  @media print {
    .${ROOT_CLASS} {
      display: none !important;
    }
  }
`;

const Meta = styled.span`
  font-size: ${fontSize.label}px;
  font-weight: 600;
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
    font-weight: 600;
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
  margin: 0 0 10px;
  font-size: 12px;
  color: ${colors.textMuted};
`;

// mantém as quebras de linha do texto oficial
const Excerpt = styled.p`
  margin: 0;
  font-size: ${fontSize.support}px;
  line-height: 1.55;
  white-space: pre-line;
  overflow-wrap: anywhere;
  color: ${colors.textDark};
`;

const Disclaimer = styled.p`
  margin: 0;
  font-size: ${fontSize.label}px;
  color: ${colors.textSubtle};
  border-top: 1px solid ${colors.border};
  padding-top: 12px;
`;

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
      <Muted>Escala: 4 ou mais = Crítica · 3 = Alta · 1–2 = Média · 0 = Baixa. Regras completas em Configurações.</Muted>
      <SectionTitle>Por que estes assuntos?</SectionTitle>
      <Steps as="ul">
        {reason.subjects.map((s) => (
          <li key={s.id}>
            {subjectName(s.id)}:{' '}
            {s.via === 'source' ? 'assunto da própria fonte' : `termo(s) encontrado(s) no texto: ${s.terms.map((t) => `"${t}"`).join(', ')}`}
          </li>
        ))}
      </Steps>
    </ReasonBox>
  );
}

function focusCloseButton(open: boolean) {
  // como antes: o foco vai para o botão de fechar ao abrir o painel
  if (open) document.querySelector<HTMLButtonElement>(`.${ROOT_CLASS} .ant-drawer-close`)?.focus();
}

export function PublicationDetail({ publication, onClose, onChange }: PublicationDetailProps) {
  const { sourceName, subjectName } = useIntelligence();
  const href = publication ? safeOfficialUrl(publication.url) : null;

  const fields = publication
    ? [
        {
          label: 'Data de publicação',
          value: publication.publishedAt
            ? `${formatPublished(publication)}${publication.publishedTime ? '' : ' (a fonte informa só a data)'}`
            : 'Não informada pela fonte',
        },
        { label: 'Tipo de ato', value: publication.actType },
        { label: 'Classificação', value: publication.normType },
        { label: 'Vigência', value: publication.effectiveDate ? formatDate(publication.effectiveDate) : null },
        { label: 'Órgão', value: publication.organ },
        { label: 'Relevância', value: RELEVANCE[publication.relevance] ? <RelevanceBadge relevance={publication.relevance} /> : null },
        {
          label: 'Assuntos',
          value: publication.subjects.length ? (
            <Flex wrap gap={4}>
              {publication.subjects.map((id) => (
                <Chip key={id}>{subjectName(id)}</Chip>
              ))}
            </Flex>
          ) : null,
        },
        { label: 'Coletado em', value: formatDateTime(publication.collectedAt) },
      ].filter((field) => field.value)
    : [];

  return (
    <>
      <DetailPrintStyle />
      <Drawer
        open={publication !== null}
        onClose={onClose}
        width={560}
        rootClassName={ROOT_CLASS}
        title={publication ? <Meta>{sourceName(publication.sourceId)}</Meta> : null}
        afterOpenChange={focusCloseButton}
        styles={{ body: { padding: '20px 28px 24px' } }}
        destroyOnHidden
      >
        {publication && (
          <Flex vertical gap={16}>
            <Title>{publication.title}</Title>
            <Fields>
              {fields.map((field) => (
                <div key={field.label}>
                  <dt>{field.label}</dt>
                  <dd>{field.value}</dd>
                </div>
              ))}
            </Fields>
            <RelevanceReason publication={publication} />
            {publication.excerpt && (
              <div>
                <SectionTitle>Trecho oficial</SectionTitle>
                <Excerpt>{publication.excerpt}</Excerpt>
              </div>
            )}
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
        )}
      </Drawer>
    </>
  );
}
