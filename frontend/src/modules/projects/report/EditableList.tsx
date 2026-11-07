import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';

import type { CharLimitField } from '@/core/hooks/useCharLimit';
import { EditableText } from '@/modules/projects/report/EditableText';
import { Bullet, BulletList, RemoveItemRow, ScreenOnly } from '@/modules/projects/report/styles';

interface EditableListProps {
  items: string[];
  editing: boolean;
  field: CharLimitField;
  emptyText: string;
  itemLabel: string;
  onAdd: () => void;
  onCommit: (index: number, text: string) => void;
  onRemove: (index: number) => void;
}

/**
 * Bulleted list of the report (attention cards and kanban). In edit mode each item
 * becomes a field (empty text removes it), with a remove button and "+ Adicionar Item".
 */
export function EditableList({ items, editing, field, emptyText, itemLabel, onAdd, onCommit, onRemove }: EditableListProps) {
  // item recém-adicionado recebe o foco com o texto selecionado
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  if (!items.length && !editing) {
    return (
      <BulletList>
        <Bullet>{emptyText}</Bullet>
      </BulletList>
    );
  }

  return (
    <BulletList>
      {items.map((item, index) => (
        <Bullet key={`${index}-${item}`} $plain={editing}>
          {editing ? (
            <RemoveItemRow>
              <EditableText
                value={item}
                editing
                field={field}
                ariaLabel={`${itemLabel} ${index + 1}`}
                autoSelect={focusIndex === index}
                onCommit={(text) => {
                  setFocusIndex(null);
                  onCommit(index, text);
                }}
              />
              <Button type="text" size="small" icon={<DeleteOutlined />} aria-label={`Excluir ${itemLabel.toLowerCase()} ${index + 1}`} onClick={() => onRemove(index)} />
            </RemoveItemRow>
          ) : (
            item
          )}
        </Bullet>
      ))}
      {editing && (
        <Bullet $plain>
          <ScreenOnly>
            <Button
              color="primary"
              variant="dashed"
              size="small"
              block
              icon={<PlusOutlined />}
              onClick={() => {
                setFocusIndex(items.length);
                onAdd();
              }}
            >
              Adicionar Item
            </Button>
          </ScreenOnly>
        </Bullet>
      )}
    </BulletList>
  );
}
