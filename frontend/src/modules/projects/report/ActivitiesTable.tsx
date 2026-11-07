import { DeleteOutlined, HolderOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Select } from 'antd';
import { useState } from 'react';

import { addActivity, moveActivity, removeActivity, renameActivity, setActivityStatus, statusTone } from '@/modules/projects/model';
import { EditableText } from '@/modules/projects/report/EditableText';
import { ActivityRow, DragCell, IdCell, MiddleCard, MiddleTitle, StatusBadge, StatusCell, Subtitle, SummaryRow, Table } from '@/modules/projects/report/styles';
import { ACTIVITY_STATUSES, type ActivityStatus, type Project } from '@/modules/projects/types';

interface ActivitiesTableProps {
  project: Project;
  editing: boolean;
  selectedId: number | null;
  onSelect: (activityId: number | null) => void;
  onChange: (project: Project) => void;
}

const STATUS_OPTIONS = ACTIVITY_STATUSES.map((status) => ({
  value: status,
  label: <StatusBadge $tone={statusTone(status)}>{status}</StatusBadge>,
}));

/** "Avanço por atividade": status of each phase; in edit mode it also renames, reorders (drag) and removes. */
export function ActivitiesTable({ project, editing, selectedId, onSelect, onChange }: ActivitiesTableProps) {
  const { modal } = App.useApp();
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);

  function confirmRemove(activityId: number, name: string) {
    modal.confirm({
      title: 'Excluir atividade',
      content: `Deseja realmente excluir a atividade "${name}"?`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk() {
        const next = removeActivity(project, activityId);
        onChange(next);
        // ids são renumerados: a seleção volta para a primeira atividade se a escolhida sumiu
        const stillSelected = selectedId !== activityId && next.activities.some((a) => a.id === selectedId);
        if (!stillSelected) onSelect(next.activities[0]?.id ?? null);
      },
    });
  }

  function drop(targetId: number) {
    setOverId(null);
    if (draggingId === null || draggingId === targetId) return;
    const moved = moveActivity(project, draggingId, targetId, selectedId);
    onChange(moved.project);
    onSelect(moved.selectedId);
    setDraggingId(null);
  }

  const columns = editing ? 5 : 3;

  return (
    <MiddleCard>
      <MiddleTitle>
        <span>
          Avanço por atividade <Subtitle>Status de cada fase do projeto</Subtitle>
        </span>
      </MiddleTitle>
      <Table>
        <thead>
          <tr>
            {editing && <th aria-label="Arrastar" />}
            <th>ID</th>
            <th>Atividade</th>
            <th>Status</th>
            {editing && <th>Ações</th>}
          </tr>
        </thead>
        <tbody>
          {project.activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              $selected={activity.id === selectedId}
              $dragging={activity.id === draggingId}
              $dropTarget={activity.id === overId && draggingId !== activity.id}
              onClick={() => onSelect(activity.id)}
              onDragOver={(e) => {
                if (draggingId === null || draggingId === activity.id) return;
                e.preventDefault();
                setOverId(activity.id);
              }}
              onDragLeave={() => setOverId((id) => (id === activity.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                drop(activity.id);
              }}
            >
              {editing && (
                <DragCell
                  draggable
                  title="Arraste para reordenar"
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(activity.id));
                    setDraggingId(activity.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverId(null);
                  }}
                >
                  <HolderOutlined />
                </DragCell>
              )}
              <IdCell>#{activity.id}</IdCell>
              <td>
                <EditableText
                  value={activity.name}
                  editing={editing}
                  field="activityName"
                  ariaLabel={`Nome da atividade ${activity.id}`}
                  onCommit={(name) => name.trim() && onChange(renameActivity(project, activity.id, name.trim()))}
                />
              </td>
              <StatusCell onClick={(e) => editing && e.stopPropagation()}>
                {editing ? (
                  <Select<ActivityStatus>
                    size="small"
                    variant="borderless"
                    popupMatchSelectWidth={false}
                    value={activity.status as ActivityStatus}
                    options={STATUS_OPTIONS}
                    onChange={(status) => onChange(setActivityStatus(project, activity.id, status))}
                    aria-label={`Status da atividade ${activity.id}`}
                  />
                ) : (
                  <StatusBadge $tone={statusTone(activity.status)}>{activity.status}</StatusBadge>
                )}
              </StatusCell>
              {editing && (
                <td>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    aria-label={`Excluir a atividade ${activity.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmRemove(activity.id, activity.name);
                    }}
                  />
                </td>
              )}
            </ActivityRow>
          ))}
          <SummaryRow>
            {editing && <td />}
            <IdCell />
            <td>AVANÇO DO PROJETO</td>
            <StatusCell>
              <StatusBadge $tone="done">PROJETO</StatusBadge>
            </StatusCell>
            {editing && <td />}
          </SummaryRow>
          {editing && (
            <tr>
              <td colSpan={columns}>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    const added = addActivity(project);
                    onChange(added.project);
                    onSelect(added.activityId);
                  }}
                >
                  Adicionar Atividade
                </Button>
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </MiddleCard>
  );
}
