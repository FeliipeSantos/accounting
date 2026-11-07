import { Input, type InputRef } from 'antd';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import styled, { css } from 'styled-components';

import { type CharLimitField, useCharLimit } from '@/core/hooks/useCharLimit';
import { colors } from '@/theme';

// campo sem caixa: o texto mantém a aparência do relatório; o contador só aparece com foco
const InlineField = styled.span<{ $onDark: boolean }>`
  display: block;
  flex: 1;
  min-width: 0;
  border-radius: 4px;
  transition:
    background-color 0.15s ease,
    box-shadow 0.15s ease;

  .ant-input,
  .ant-input-affix-wrapper {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
    padding: 1px 4px;
    background: transparent;
  }

  .ant-input-show-count-suffix,
  .ant-input-data-count {
    display: none;
    font-size: 0.65rem;
    font-weight: 400;
    letter-spacing: normal;
    color: ${({ $onDark }) => ($onDark ? 'rgba(255, 255, 255, 0.7)' : colors.textMuted)};
  }

  &:hover {
    background-color: rgba(26, 115, 232, 0.08);
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
  }

  &:focus-within {
    box-shadow: 0 0 0 2px ${colors.blue};
    ${({ $onDark }) =>
      $onDark
        ? css`
            background-color: rgba(255, 255, 255, 0.1);
          `
        : css`
            background-color: #fff;
          `}

    .ant-input-show-count-suffix {
      display: inline;
    }

    /* contador do TextArea fica abaixo do campo, ocupando espaço só com foco */
    .ant-input-data-count {
      display: block;
      position: static;
      text-align: right;
    }
  }
`;

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
  /** Field drawn over a dark background (report header). */
  onDark?: boolean;
}

/**
 * Text of the report: plain text outside edit mode; in edit mode a borderless field that
 * keeps the report look, with the length limit and a counter shown while focused. The
 * change is applied when the field loses focus (Enter also applies it on single-line fields).
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
  onDark = false,
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

  return (
    <InlineField $onDark={onDark}>
      {multiline ? (
        <Input.TextArea
          variant="borderless"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          autoSize={{ minRows: 1, maxRows: 8 }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          {...limit}
        />
      ) : (
        <Input
          ref={inputRef}
          variant="borderless"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onPressEnter={(e) => e.currentTarget.blur()}
          placeholder={placeholder}
          aria-label={ariaLabel}
          {...limit}
        />
      )}
    </InlineField>
  );
}
