import { ExportOutlined } from '@ant-design/icons';
import { Alert, Button, Descriptions, Drawer, Flex, Typography } from 'antd';

import { FavoriteButton } from '@/modules/intelligence/components/PublicationParts';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatDate, formatDateTime, formatPublished, RELEVANCE, relevanceSteps, safeOfficialUrl } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';

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
    return <Typography.Paragraph type="secondary">Critério não registrado para esta publicação (coletada antes desta informação existir).</Typography.Paragraph>;
  }
  return (
    <Alert
      type="info"
      message={`Por que a relevância é "${RELEVANCE[publication.relevance].label}"?`}
      description={
        <>
          <ol>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <Typography.Text type="secondary">Escala: 4 ou mais = Crítica · 3 = Alta · 1–2 = Média · 0 = Baixa. Regras completas em Configurações.</Typography.Text>
          <Typography.Title level={5}>Por que estes assuntos?</Typography.Title>
          <ul>
            {reason.subjects.map((s) => (
              <li key={s.id}>
                {subjectName(s.id)}:{' '}
                {s.via === 'source' ? 'assunto da própria fonte' : `termo(s) encontrado(s) no texto: ${s.terms.map((t) => `"${t}"`).join(', ')}`}
              </li>
            ))}
          </ul>
        </>
      }
    />
  );
}

export function PublicationDetail({ publication, onClose, onChange }: PublicationDetailProps) {
  const { sourceName, subjectName } = useIntelligence();
  const href = publication ? safeOfficialUrl(publication.url) : null;

  return (
    <Drawer open={publication !== null} onClose={onClose} width={560} title={publication ? sourceName(publication.sourceId) : ''} destroyOnHidden>
      {publication && (
        <Flex vertical gap={16}>
          <Typography.Title level={4}>{publication.title}</Typography.Title>
          <Descriptions
            column={1}
            size="small"
            items={[
              {
                key: 'published',
                label: 'Data de publicação',
                children: publication.publishedAt
                  ? `${formatPublished(publication)}${publication.publishedTime ? '' : ' (a fonte informa só a data)'}`
                  : 'Não informada pela fonte',
              },
              { key: 'type', label: 'Tipo de ato', children: publication.actType },
              { key: 'norm', label: 'Classificação', children: publication.normType },
              { key: 'effective', label: 'Vigência', children: publication.effectiveDate ? formatDate(publication.effectiveDate) : null },
              { key: 'organ', label: 'Órgão', children: publication.organ },
              { key: 'relevance', label: 'Relevância', children: RELEVANCE[publication.relevance]?.label },
              { key: 'subjects', label: 'Assuntos', children: publication.subjects.map(subjectName).join(', ') },
              { key: 'collected', label: 'Coletado em', children: formatDateTime(publication.collectedAt) },
            ].filter((item) => item.children)}
          />
          <RelevanceReason publication={publication} />
          {publication.excerpt && (
            <div>
              <Typography.Title level={5}>Trecho oficial</Typography.Title>
              <Typography.Paragraph>{publication.excerpt}</Typography.Paragraph>
            </div>
          )}
          <Flex gap={8} align="center">
            {href && (
              <Button type="primary" href={href} target="_blank" rel="noopener noreferrer" icon={<ExportOutlined />}>
                Abrir fonte oficial
              </Button>
            )}
            <FavoriteButton publication={publication} onChange={onChange} size="middle" />
          </Flex>
          <Typography.Text type="secondary">Conteúdo reproduzido da fonte oficial. Não constitui parecer jurídico ou contábil.</Typography.Text>
        </Flex>
      )}
    </Drawer>
  );
}
