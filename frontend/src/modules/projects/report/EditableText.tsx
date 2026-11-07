import { Input, type InputRef } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { type CharLimitField, useCharLimit } from '@/core/hooks/useCharLimit';

interface EditableTextProps {
  value: string;
  editing: boolean;
  field: CharLimitField;
  onCommit: (value: string) => void;
  /** How the value appears outside edit mode (defaults to the plain text). */
  display?: ReactNode;
  multiline?: boolean;
  placeholder?: string;
  ariaLabel: string;
  /** Focus and select the whole text when it appears (new items). */
  autoSelect?: boolean;
  size?: 'small' | 'middle' | 'large';
}

/**
 * Text of the report: plain text outside edit mode; in edit mode a field with the
 * length limit and counter. The change is applied when the field loses focus
 * (Enter also applies it on single-line fields).
 */
export function EditableText({
  value,
  editing,
  field,
  onCommit,
  display,
  multiline = false,
  placeholder,
  ariaLabel,
  autoSelect = false,
  size = 'small',
}: EditableTextProps) {
  const [draft, setDraft] = useState(value);
  const limit = useCharLimit(field);
  const inputRef = useRef<InputRef>(null);

  // valor alterado fora do campo (ex.: cancelar edição): o rascunho acompanha
  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (editing && autoSelect) inputRef.current?.focus({ cursor: 'all' });
  }, [editing, autoSelect]);

  if (!editing) return <>{display ?? value}</>;

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  if (multiline) {
    return (
      <Input.TextArea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        autoSize={{ minRows: 2, maxRows: 8 }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onClick={(e) => e.stopPropagation()}
        {...limit}
      />
    );
  }

  return (
    <Input
      ref={inputRef}
      size={size}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onPressEnter={(e) => e.currentTarget.blur()}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      {...limit}
    />
  );
}
