import { addKanbanCard, addListItem, removeKanbanCard, removeListItem, setKanbanCard, setListItem } from '@/modules/projects/model';
import { EditableList } from '@/modules/projects/report/EditableList';
import {
  type Accent,
  AttentionCard,
  AttentionRow,
  AttentionTitle,
  Bullet,
  BulletList,
  CountBadge,
  KanbanBody,
  KanbanColumnBox,
  KanbanHeader,
  KanbanRow,
} from '@/modules/projects/report/styles';
import type { Activity, ActivityListKey, KanbanColumn, Project } from '@/modules/projects/types';
import { colors } from '@/theme';

interface SectionProps {
  project: Project;
  editing: boolean;
  onChange: (project: Project) => void;
}

const ATTENTION_CARDS: { key: ActivityListKey; title: string; accent: Accent }[] = [
  { key: 'attentionPoints', title: 'Pontos de Atenção', accent: 'blue' },
  { key: 'projectImpacts', title: 'Impactos no Projeto', accent: 'green' },
  { key: 'actionPlans', title: 'Planos de Ação', accent: 'orange' },
];

/** The three lists of the selected activity: attention points, impacts and action plans. */
export function AttentionCards({ project, editing, onChange, activity }: SectionProps & { activity: Activity | null }) {
  return (
    <AttentionRow>
      {ATTENTION_CARDS.map(({ key, title, accent }) => (
        <AttentionCard key={key} $accent={accent}>
          <AttentionTitle $accent={accent}>
            <span>{title}</span>
            <span>{activity ? `de: ${activity.name}` : 'Nenhuma atividade selecionada'}</span>
          </AttentionTitle>
          {activity ? (
            <EditableList
              items={activity[key]}
              editing={editing}
              field="listItem"
              itemLabel="Item"
              emptyText="Nenhum item registrado."
              onAdd={() => onChange(addListItem(project, activity.id, key))}
              onCommit={(index, text) => onChange(setListItem(project, activity.id, key, index, text))}
              onRemove={(index) => onChange(removeListItem(project, activity.id, key, index))}
            />
          ) : (
            <BulletList>
              <Bullet $plain>Selecione uma atividade para visualizar.</Bullet>
            </BulletList>
          )}
        </AttentionCard>
      ))}
    </AttentionRow>
  );
}

const KANBAN_COLUMNS: { key: KanbanColumn; title: string; color: string }[] = [
  { key: 'done', title: 'DONE', color: colors.green },
  { key: 'doing', title: 'DOING', color: colors.orange },
  { key: 'todo', title: 'TO DO', color: colors.navy },
];

export function KanbanBoard({ project, editing, onChange }: SectionProps) {
  return (
    <KanbanRow>
      {KANBAN_COLUMNS.map(({ key, title, color }) => {
        const cards = project.kanban?.[key] ?? [];
        return (
          <KanbanColumnBox key={key}>
            <KanbanHeader $column={key}>
              <span>{title}</span>
              <CountBadge $color={color}>{cards.length}</CountBadge>
            </KanbanHeader>
            <KanbanBody>
              <EditableList
                items={cards}
                editing={editing}
                field="kanbanCard"
                itemLabel="Cartão"
                emptyText="Nenhum item nesta etapa."
                onAdd={() => onChange(addKanbanCard(project, key))}
                onCommit={(index, text) => onChange(setKanbanCard(project, key, index, text))}
                onRemove={(index) => onChange(removeKanbanCard(project, key, index))}
              />
            </KanbanBody>
          </KanbanColumnBox>
        );
      })}
    </KanbanRow>
  );
}
