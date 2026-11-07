import { ExportOutlined } from '@ant-design/icons';
import { Card, Empty, Flex, Tag, Tooltip, Typography } from 'antd';
import styled from 'styled-components';

import { FavoriteButton, RelevanceTag } from '@/modules/intelligence/components/PublicationParts';
import { useIntelligence } from '@/modules/intelligence/context';
import { formatPublished, safeOfficialUrl } from '@/modules/intelligence/format';
import type { Publication } from '@/modules/intelligence/types';
import { colors, shadows } from '@/theme';

const ClickableCard = styled(Card)`
  cursor: pointer;
  transition: box-shadow 0.2s ease;

  &:hover,
  &:focus-visible {
    box-shadow: ${shadows.md};
    outline: none;
  }
`;

const Title = styled(Typography.Text)`
  &&& {
    display: block;
    font-weight: 700;
    color: ${colors.navy};
    margin: 4px 0;
  }
`;

interface PublicationCardProps {
  publication: Publication;
  onChange: (publication: Publication) => void;
}

export function PublicationCard({ publication, onChange }: PublicationCardProps) {
  const { sourceName, subjectName, openDetail } = useIntelligence();
  const href = safeOfficialUrl(publication.url);
  const open = () => openDetail(publication, onChange);

  return (
    <ClickableCard size="small" tabIndex={0} onClick={open} onKeyDown={(e) => e.key === 'Enter' && open()}>
      <Flex justify="space-between" align="center" gap={8}>
        <Typography.Text type="secondary">
          {sourceName(publication.sourceId)}
          {publication.actType && ` · ${publication.actType}`}
        </Typography.Text>
        <FavoriteButton publication={publication} onChange={onChange} />
      </Flex>
      <Title>{publication.title}</Title>
      {publication.excerpt && (
        <Typography.Paragraph type="secondary" ellipsis={{ rows: 3 }}>
          {publication.excerpt}
        </Typography.Paragraph>
      )}
      <Flex wrap gap={6} align="center">
        <Tooltip title={publication.publishedTime ? 'Data e hora de publicação na fonte oficial' : 'A fonte informa apenas a data'}>
          <Tag bordered={false}>{formatPublished(publication) ?? 'Data não informada'}</Tag>
        </Tooltip>
        <RelevanceTag publication={publication} />
        {publication.subjects.slice(0, 3).map((id) => (
          <Tag key={id} color="blue" bordered={false}>
            {subjectName(id)}
          </Tag>
        ))}
        {href && (
          <Typography.Link href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            Fonte oficial <ExportOutlined />
          </Typography.Link>
        )}
      </Flex>
    </ClickableCard>
  );
}

interface PublicationListProps {
  items: Publication[];
  emptyText: string;
  onChange: (publication: Publication) => void;
}

export function PublicationList({ items, emptyText, onChange }: PublicationListProps) {
  if (!items.length) return <Empty description={emptyText} />;
  return (
    <Flex vertical gap={12}>
      {items.map((publication) => (
        <PublicationCard key={publication.id} publication={publication} onChange={onChange} />
      ))}
    </Flex>
  );
}
