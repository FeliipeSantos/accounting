import { AuditOutlined, CalendarOutlined, FileTextOutlined, NotificationOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Tooltip, Typography } from 'antd';
import { Fragment, type ReactNode, useMemo } from 'react';
import styled, { css } from 'styled-components';

import { EmptyState, IconCircle } from '@/core/ui';
import { FavoriteButton, RelevanceTag } from '@/modules/intelligence/components/PublicationParts';
import { useIntelligence } from '@/modules/intelligence/context';
import {
  type ActIconKind,
  actIconKind,
  formatPublished,
  groupSameAct,
  type PublicationGroup,
  REFORM_SUBJECTS,
  RELEVANCE,
  RELEVANCE_ICON_TONE,
  safeOfficialUrl,
} from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';
import { colors, fontSize, type IconTone, iconTones, radius, shadows } from '@/theme';

const ACT_ICONS: Record<ActIconKind, ReactNode> = {
  law: <AuditOutlined />,
  notice: <NotificationOutlined />,
  document: <FileTextOutlined />,
};

const ListBox = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
`;

// linha arredondada: ícone por tipo de ato (cor = relevância), textos e seta
const Row = styled.div<{ $raised: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 14px 16px;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
  ${({ $raised }) =>
    $raised &&
    css`
      box-shadow: ${shadows.sm};
    `}

  &:hover {
    border-color: ${colors.borderStrong};
    box-shadow: ${shadows.md};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  @media (max-width: 600px) {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 12px;

    > .publication-chevron {
      display: none;
    }
  }
`;

const Body = styled.div`
  min-width: 0;
`;

const Title = styled.div`
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  color: ${colors.textDark};
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Excerpt = styled.p<{ $rows: number }>`
  margin: 4px 0 0;
  font-size: ${fontSize.support}px;
  line-height: 1.45;
  color: ${colors.textMuted};
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: ${({ $rows }) => $rows};
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin-top: 8px;
`;

const MetaText = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${colors.textMuted};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

// pílula suave do assunto: roxo para a Reforma Tributária, azul para os demais
const SubjectPill = styled.span<{ $tone: IconTone }>`
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 10px;
  border-radius: ${radius.badge}px;
  background: ${({ $tone }) => iconTones[$tone].bg};
  color: ${({ $tone }) => iconTones[$tone].fg};
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
`;

const GroupNote = styled.span`
  font-size: 11.5px;
  font-weight: 600;
  color: ${colors.blue};
`;

const GroupLink = styled(Button)`
  &&& {
    height: auto;
    padding: 0;
    font-size: 11.5px;
    font-weight: 600;
  }
`;

const OfficialLink = styled(Typography.Link)`
  &&& {
    font-size: 12px;
    font-weight: 600;
  }
`;

const Chevron = styled(RightOutlined)`
  color: ${colors.textSubtle};
  font-size: 13px;
`;

const EmptyText = styled.p`
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

interface PublicationItemProps {
  group: PublicationGroup;
  excerptRows: number;
  raised: boolean;
  onChange: (publication: Publication) => void;
}

/** One publication of a list: act icon colored by relevance, title, excerpt, date, subject, favorite. */
export function PublicationItem({ group, excerptRows, raised, onChange }: PublicationItemProps) {
  const { sourceName, subjectName, openDetail } = useIntelligence();
  const { primary: publication, others } = group;
  const href = safeOfficialUrl(publication.url);
  const open = () => openDetail(publication, onChange);
  const relevance = RELEVANCE[publication.relevance];
  const [firstSubject, ...moreSubjects] = publication.subjects;

  return (
    <Row role="button" tabIndex={0} $raised={raised} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <IconCircle $tone={RELEVANCE_ICON_TONE[publication.relevance] ?? 'gray'} $size={44} aria-hidden title={relevance ? `Relevância ${relevance.label}` : undefined}>
        {ACT_ICONS[actIconKind(publication)]}
      </IconCircle>
      <Body>
        <Title>{publication.title}</Title>
        {publication.excerpt && <Excerpt $rows={excerptRows}>{publication.excerpt}</Excerpt>}
        <Meta>
          <Tooltip title={publication.publishedTime ? 'Data e hora de publicação na fonte oficial' : 'A fonte informa apenas a data'}>
            <MetaText>
              <CalendarOutlined aria-hidden />
              {formatPublished(publication) ?? 'Data não informada'}
            </MetaText>
          </Tooltip>
          {firstSubject && (
            <Tooltip title={moreSubjects.length ? publication.subjects.map(subjectName).join(', ') : undefined}>
              <SubjectPill $tone={REFORM_SUBJECTS.includes(firstSubject) ? 'purple' : 'blue'}>
                {subjectName(firstSubject)}
                {moreSubjects.length > 0 && ` +${moreSubjects.length}`}
              </SubjectPill>
            </Tooltip>
          )}
          <RelevanceTag publication={publication} />
          <MetaText>
            {sourceName(publication.sourceId)}
            {publication.actType && ` · ${publication.actType}`}
          </MetaText>
          {others.length > 0 && (
            <GroupNote>
              +{others.length} {others.length === 1 ? 'fonte' : 'fontes'}:{' '}
              {others.map((other, i) => (
                <Fragment key={other.id}>
                  {i > 0 && ', '}
                  <GroupLink
                    type="link"
                    title={`Abrir a publicação em ${sourceName(other.sourceId)}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(other, onChange);
                    }}
                  >
                    {sourceName(other.sourceId)}
                  </GroupLink>
                </Fragment>
              ))}
            </GroupNote>
          )}
          {href && (
            <OfficialLink href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              Fonte oficial ↗
            </OfficialLink>
          )}
          <FavoriteButton publication={publication} onChange={onChange} variant="text" />
        </Meta>
      </Body>
      <Chevron className="publication-chevron" aria-hidden />
    </Row>
  );
}

interface PublicationListProps {
  items: Publication[];
  emptyText: string;
  onChange: (publication: Publication) => void;
  /** Shows the same act from different sources as one item (display only). */
  groupSources?: boolean;
  /** Lines of the excerpt (1 in compact lists). */
  excerptRows?: number;
  /** Inside a SectionCard: rows without shadow and a plain empty text. */
  bare?: boolean;
}

export function PublicationList({ items, emptyText, onChange, groupSources = false, excerptRows = 2, bare = false }: PublicationListProps) {
  const groups = useMemo(() => (groupSources ? groupSameAct(items) : items.map((primary) => ({ primary, others: [] }))), [items, groupSources]);
  if (!items.length) return bare ? <EmptyText role="status">{emptyText}</EmptyText> : <EmptyState>{emptyText}</EmptyState>;
  return (
    <ListBox>
      {groups.map((group) => (
        <PublicationItem key={group.primary.id} group={group} excerptRows={excerptRows} raised={!bare} onChange={onChange} />
      ))}
    </ListBox>
  );
}
