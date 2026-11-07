import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Checkbox, Flex, Input } from 'antd';
import { useState } from 'react';

import { useCharLimit } from '@/core/hooks/useCharLimit';
import { addSubActivity, removeSubActivity, renameSubActivity } from '@/modules/projects/model';
import { EditableText } from '@/modules/projects/report/EditableText';
import { CountBadge, EmptyBox, MiddleCard, MiddleTitle, ScreenOnly, ScrollList, SubActivityItem, Subtitle } from '@/modules/projects/report/styles';
import type { Activity, Project } from '@/modules/projects/types';
import { colors } from '@/theme';

interface SubActivitiesCardProps {
  project: Project;
  activity: Activity | null;
  editing: boolean;
  onChange: (project: Project) => void;
  /** Checking an item outside edit mode is saved right away. */
  onToggle: (index: number, completed: boolean) => void;
}

export function SubActivitiesCard({ project, activity, editing, onChange, onToggle }: SubActivitiesCardProps) {
  const [newName, setNewName] = useState('');
  const nameLimit = useCharLimit('subActivityName');

  function add() {
    if (!activity || !newName.trim()) return;
    onChange(addSubActivity(project, activity.id, newName));
    setNewName('');
  }

  return (
    <MiddleCard>
      <MiddleTitle>
        <span>
          Subatividades <Subtitle>{activity ? `de: ${activity.name}` : 'Selecione uma atividade para detalhar'}</Subtitle>
        </span>
        {activity && <CountBadge $color={colors.blue}>{activity.subActivities.length}</CountBadge>}
      </MiddleTitle>

      {!activity && <EmptyBox>Selecione uma atividade à esquerda clicando em sua linha para visualizar e gerenciar suas subatividades.</EmptyBox>}

      {activity && editing && (
        <ScreenOnly>
          <Flex gap={8}>
            <Input
              size="small"
              placeholder="Nova subatividade..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={add}
              aria-label="Nova subatividade"
              {...nameLimit}
            />
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={add}>
              Adicionar
            </Button>
          </Flex>
        </ScreenOnly>
      )}

      {activity && !activity.subActivities.length && <EmptyBox>Nenhuma subatividade nesta etapa. Adicione uma acima!</EmptyBox>}

      {activity && activity.subActivities.length > 0 && (
        <ScrollList>
          {activity.subActivities.map((sub, index) => (
            <SubActivityItem key={`${activity.id}-${index}-${sub.name}`} $completed={sub.completed}>
              <Flex gap={8} align="center" flex={1}>
                <Checkbox checked={sub.completed} onChange={(e) => onToggle(index, e.target.checked)} aria-label={`Concluir: ${sub.name}`} />
                <EditableText
                  value={sub.name}
                  editing={editing}
                  field="subActivityName"
                  ariaLabel={`Subatividade ${index + 1}`}
                  onCommit={(name) => onChange(renameSubActivity(project, activity.id, index, name))}
                />
              </Flex>
              {editing && (
                <Button
                  type="text"
                  size="small"
                  icon={<DeleteOutlined />}
                  aria-label={`Excluir subatividade ${sub.name}`}
                  onClick={() => onChange(removeSubActivity(project, activity.id, index))}
                />
              )}
            </SubActivityItem>
          ))}
        </ScrollList>
      )}
    </MiddleCard>
  );
}
