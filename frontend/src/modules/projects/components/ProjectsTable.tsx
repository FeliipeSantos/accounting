import { CalendarOutlined, CheckCircleOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined, FileTextOutlined, MoreOutlined } from '@ant-design/icons';
import { Button, Dropdown, Flex, Table, Tooltip } from 'antd';
import type { Dayjs } from 'dayjs';
import styled from 'styled-components';

import { IconCircle, ProgressBar, StatusBadge } from '@/core/ui';
import { projectProgress } from '@/modules/projects/model';
import { activityBreakdown, formatPercent, PROJECT_STATUS, projectDeadline, projectStatus, type ProjectStatus } from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';
import { colors, type IconTone, tones } from '@/theme';

const STATUS_ICON: Record<ProjectStatus, { icon: JSX.Element; tone: IconTone }> = {
  ongoing: { icon: <FileTextOutlined />, tone: 'blue' },
  todo: { icon: <ClockCircleOutlined />, tone: 'orange' },
  done: { icon: <CheckCircleOutlined />, tone: 'green' },
};

const ProjectName = styled.button`
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-weight: 500;
  color: ${colors.textDark};
  text-align: left;
  cursor: pointer;
  min-width: 180px;
  overflow-wrap: anywhere;

  &:hover {
    color: ${colors.blue};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const Muted = styled.span`
  color: ${colors.textMuted};
  font-size: 13px;
  white-space: nowrap;
`;

const Percent = styled.span`
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  min-width: 52px;
`;

const ProgressCell = styled(Flex)`
  min-width: 170px;

  > :last-child {
    flex: 1;
  }
`;

const DateCell = styled.span<{ $overdue: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  color: ${({ $overdue }) => ($overdue ? tones.danger.fg : colors.textDark)};
  font-weight: ${({ $overdue }) => ($overdue ? 600 : 400)};
`;

const ActionButton = styled(Button)`
  &&& {
    color: ${colors.textMuted};
  }

  &&&:hover {
    color: ${colors.blue};
  }
`;

const StyledTable = styled(Table<Project>)`
  .ant-table-thead > tr > th {
    background: transparent;
    color: ${colors.textDark};
    font-weight: 500;
    font-size: 13px;
  }

  .ant-table-tbody > tr > td {
    padding-block: 14px;
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }
`;

interface ProjectsTableProps {
  projects: Project[];
  today: Dayjs;
  onOpen: (project: Project) => void;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
  emptyText: string;
}

/** "Meus Projetos": one row per project with status, progress, deadline and actions. */
export function ProjectsTable({ projects, today, onOpen, onEdit, onDelete, emptyText }: ProjectsTableProps) {
  return (
    <StyledTable
      rowKey="id"
      dataSource={projects}
      pagination={false}
      scroll={{ x: 900 }}
      locale={{ emptyText }}
      columns={[
        {
          title: 'Projeto',
          key: 'name',
          render: (_, project) => {
            const status = STATUS_ICON[projectStatus(project)];
            return (
              <Flex align="center" gap={12}>
                <IconCircle $tone={status.tone} $size={32} aria-hidden>
                  {status.icon}
                </IconCircle>
                <ProjectName type="button" onClick={() => onOpen(project)}>
                  {project.name}
                </ProjectName>
              </Flex>
            );
          },
        },
        {
          title: 'Atividades',
          key: 'activities',
          render: (_, project) => {
            const b = activityBreakdown(project);
            return b.total ? (
              <Muted>
                {b.done} / {b.total} concluídas
              </Muted>
            ) : (
              <Muted>Sem atividades</Muted>
            );
          },
        },
        {
          title: 'Status',
          key: 'status',
          render: (_, project) => {
            const status = PROJECT_STATUS[projectStatus(project)];
            return <StatusBadge tone={status.tone}>{status.label}</StatusBadge>;
          },
        },
        {
          title: 'Progresso',
          key: 'progress',
          render: (_, project) => {
            const progress = projectProgress(project);
            const tone = PROJECT_STATUS[projectStatus(project)].tone;
            return (
              <ProgressCell align="center" gap={10}>
                <Percent>{formatPercent(progress)}%</Percent>
                <ProgressBar value={progress} tone={tone} label={`Progresso de ${project.name}`} />
              </ProgressCell>
            );
          },
        },
        {
          title: 'Prazo',
          key: 'deadline',
          render: (_, project) => {
            const deadline = projectDeadline(project, today);
            const overdue = deadline.kind === 'overdue';
            return (
              <Tooltip title={deadline.label}>
                <DateCell $overdue={overdue}>
                  <CalendarOutlined />
                  {project.endDate || '—'}
                </DateCell>
              </Tooltip>
            );
          },
        },
        {
          title: 'Ações',
          key: 'actions',
          align: 'right',
          width: 130,
          render: (_, project) => (
            <Flex justify="flex-end" gap={2}>
              <Tooltip title="Abrir relatório">
                <ActionButton type="text" icon={<EyeOutlined />} onClick={() => onOpen(project)} aria-label={`Abrir o projeto ${project.name}`} />
              </Tooltip>
              <Tooltip title="Editar">
                <ActionButton type="text" icon={<EditOutlined />} onClick={() => onEdit(project)} aria-label={`Editar o projeto ${project.name}`} />
              </Tooltip>
              <Dropdown
                trigger={['click']}
                placement="bottomRight"
                menu={{ items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Excluir projeto…', danger: true, onClick: () => onDelete(project) }] }}
              >
                <ActionButton type="text" icon={<MoreOutlined />} aria-label={`Mais ações do projeto ${project.name}`} />
              </Dropdown>
            </Flex>
          ),
        },
      ]}
    />
  );
}
