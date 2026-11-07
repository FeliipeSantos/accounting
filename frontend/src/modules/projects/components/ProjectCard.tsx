import { DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Progress, Tag, Typography } from 'antd';
import styled from 'styled-components';

import { projectProgress } from '@/modules/projects/model';
import type { Project } from '@/modules/projects/types';
import { colors, shadows } from '@/theme';

const HoverCard = styled(Card)`
  height: 100%;
  min-height: 230px;
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    transform: translateY(-5px);
    box-shadow: ${shadows.lg};
  }
`;

const Name = styled(Typography.Text)`
  &&& {
    font-size: 1.05rem;
    font-weight: 700;
    color: ${colors.navy};
    line-height: 1.3;
  }
`;

const Footer = styled(Flex)`
  border-top: 1px solid ${colors.border};
  padding-top: 14px;
  margin-top: auto;
`;

interface ProjectCardProps {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const progress = projectProgress(project);
  return (
    <HoverCard styles={{ body: { height: '100%', display: 'flex', flexDirection: 'column', gap: 14 } }}>
      <Flex justify="space-between" align="flex-start" gap={12}>
        <Name>{project.name}</Name>
        {project.reportDate && <Tag bordered={false}>{project.reportDate}</Tag>}
      </Flex>
      <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
        {project.description || 'Sem descrição cadastrada.'}
      </Typography.Paragraph>
      <div>
        <Flex justify="space-between">
          <Typography.Text strong>Avanço Geral</Typography.Text>
          <Typography.Text strong>{progress}%</Typography.Text>
        </Flex>
        <Progress percent={progress} showInfo={false} strokeColor={colors.blue} />
      </div>
      <Footer justify="space-between" align="center">
        <Typography.Text type="secondary">
          <UnorderedListOutlined /> {project.activities.length} Ativ.
        </Typography.Text>
        <Flex gap={6}>
          <Button type="primary" size="small" onClick={onOpen}>
            Editar
          </Button>
          <Button danger size="small" icon={<DeleteOutlined />} onClick={onDelete} aria-label={`Excluir o projeto ${project.name}`} />
        </Flex>
      </Footer>
    </HoverCard>
  );
}
