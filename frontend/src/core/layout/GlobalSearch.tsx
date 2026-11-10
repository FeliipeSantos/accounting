import { SearchOutlined } from '@ant-design/icons';
import { AutoComplete, Input, type InputRef } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useCharLimit } from '@/core/hooks/useCharLimit';
import type { ModuleSearch, SearchResult } from '@/core/layout/search';
import { IconCircle } from '@/core/ui';
import { colors } from '@/theme';

const SEARCH_DELAY_MS = 300;
const ALL_KEY = '__all__';

const Field = styled(AutoComplete)`
  flex: 1;
  min-width: 0;
  max-width: 460px;
`;

const Shortcut = styled.kbd`
  font: inherit;
  font-size: 11.5px;
  color: ${colors.textSubtle};
  white-space: nowrap;

  @media (max-width: 900px) {
    display: none;
  }
`;

const Option = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 2px 0;
`;

const OptionTexts = styled.span`
  display: flex;
  flex-direction: column;
  min-width: 0;

  b {
    font-size: 13px;
    font-weight: 500;
    color: ${colors.textDark};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    font-size: 12px;
    color: ${colors.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const AllResults = styled.span`
  font-size: 13px;
  font-weight: 500;
  color: ${colors.blue};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
`;

const Status = styled.div`
  padding: 6px 4px;
  font-size: 13px;
  color: ${colors.textMuted};
`;

interface Results {
  term: string;
  items: SearchResult[];
  failed: boolean;
}

/**
 * Search field of the global header. It only queries the open module, so the results
 * always belong to the screen the user is working on.
 */
export function GlobalSearch({ moduleKey, search }: { moduleKey: string; search: ModuleSearch }) {
  const navigate = useNavigate();
  const inputRef = useRef<InputRef>(null);
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Results | null>(null);
  const limit = useCharLimit('globalSearch');
  const trimmed = term.trim();

  // trocou de módulo: a busca recomeça vazia, com os resultados do novo módulo
  useEffect(() => {
    setTerm('');
    setResults(null);
  }, [moduleKey]);

  // consulta o módulo depois de uma pausa na digitação; respostas antigas são descartadas
  useEffect(() => {
    if (!trimmed) {
      setResults(null);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      search
        .search(trimmed)
        .then((items) => active && setResults({ term: trimmed, items, failed: false }))
        .catch(() => active && setResults({ term: trimmed, items: [], failed: true }));
    }, SEARCH_DELAY_MS);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [trimmed, search]);

  // Ctrl+K (ou Cmd+K) leva o foco para a busca de qualquer tela
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = results && results.term === trimmed ? results : null;

  function pick(key: string) {
    const item = current?.items.find((result) => result.id === key);
    if (key === ALL_KEY) navigate(search.allResultsPath(trimmed));
    else if (item) navigate(item.path, { state: item.state });
    else return;
    setTerm('');
    setResults(null);
    inputRef.current?.blur();
  }

  const options = trimmed
    ? [
        // primeira opção: Enter sem escolher um item lista todos os resultados no módulo
        { value: ALL_KEY, label: <AllResults>Ver {search.everything} para “{trimmed}”</AllResults> },
        ...(current?.items ?? []).map((item) => ({
          value: item.id,
          label: (
            <Option>
              <IconCircle $tone={item.tone} $size={30} aria-hidden>
                {item.icon}
              </IconCircle>
              <OptionTexts>
                <b>{item.title}</b>
                {item.description && <small>{item.description}</small>}
              </OptionTexts>
            </Option>
          ),
        })),
      ]
    : [];

  const status = !trimmed ? null : !current ? 'Buscando...' : current.failed ? 'Não foi possível buscar agora.' : current.items.length === 0 ? `Nenhum resultado em ${search.noun}.` : null;

  return (
    <Field
      value={term}
      options={options}
      // o AutoComplete controla o campo de texto: o limite é aplicado aqui, e o contador mostra o máximo
      onSearch={(value) => setTerm(value.slice(0, limit.maxLength))}
      onSelect={(value) => pick(String(value))}
      defaultActiveFirstOption
      popupMatchSelectWidth={false}
      styles={{ popup: { root: { width: 'min(460px, calc(100vw - 32px))' } } }}
      popupRender={(menu) => (
        <>
          {menu}
          {status && <Status role="status">{status}</Status>}
        </>
      )}
    >
      <Input
        ref={inputRef}
        prefix={<SearchOutlined />}
        suffix={!term && <Shortcut>Ctrl + K</Shortcut>}
        placeholder={search.placeholder}
        aria-label={search.placeholder}
        allowClear
        showCount={limit.showCount && term.length > 0}
        count={{ max: limit.maxLength }}
      />
    </Field>
  );
}
