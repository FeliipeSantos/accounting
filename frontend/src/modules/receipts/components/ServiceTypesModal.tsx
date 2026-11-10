import { CheckOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Flex, Input, Modal, Switch, Tooltip } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { serviceTypesApi } from '@/modules/receipts/api';
import type { ServiceType } from '@/modules/receipts/types';
import { colors } from '@/theme';

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 420px;
  overflow-y: auto;
`;

const Row = styled.li<{ $inactive: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid ${colors.border};
  opacity: ${({ $inactive }) => ($inactive ? 0.6 : 1)};
`;

const Uses = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
  white-space: nowrap;
  min-width: 92px;
  text-align: right;
`;

const AddRow = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 14px;
`;

const Hint = styled.p`
  margin: 0 0 8px;
  color: ${colors.textMuted};
  font-size: 13px;
`;

interface ServiceTypesModalProps {
  open: boolean;
  types: ServiceType[];
  onChange: (types: ServiceType[]) => void;
  onClose: () => void;
}

/** Manage the kinds of work: add, rename, (de)activate, and delete the ones never used. */
export function ServiceTypesModal({ open, types, onChange, onClose }: ServiceTypesModalProps) {
  const { message, modal } = App.useApp();
  const [names, setNames] = useState<Record<number, string>>({});
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const replace = (updated: ServiceType) => onChange(types.map((t) => (t.id === updated.id ? updated : t)));
  const fail = (err: unknown) => !(err instanceof SessionExpiredError) && message.error(errorMessage(err));

  async function rename(type: ServiceType) {
    const name = (names[type.id] ?? type.name).trim();
    if (!name || name === type.name) return;
    try {
      replace(await serviceTypesApi.update(type.id, { name }));
      setNames((current) => {
        const next = { ...current };
        delete next[type.id];
        return next;
      });
      message.success('Nome atualizado');
    } catch (err) {
      fail(err);
    }
  }

  async function toggle(type: ServiceType, active: boolean) {
    try {
      replace(await serviceTypesApi.update(type.id, { active }));
    } catch (err) {
      fail(err);
    }
  }

  function remove(type: ServiceType) {
    modal.confirm({
      title: 'Excluir tipo de trabalho',
      content: `"${type.name}" será excluído da lista.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      async onOk() {
        try {
          await serviceTypesApi.remove(type.id);
          onChange(types.filter((t) => t.id !== type.id));
        } catch (err) {
          fail(err);
        }
      },
    });
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const created = await serviceTypesApi.create(name);
      onChange([...types, created]);
      setNewName('');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Tipos de trabalho" open={open} onCancel={onClose} footer={<Button onClick={onClose}>Fechar</Button>} width={600} destroyOnHidden>
      <Hint>Desative um tipo para tirá-lo da escolha sem perder os recebimentos já lançados com ele. Só tipos nunca usados podem ser excluídos.</Hint>
      <List>
        {types.map((type) => {
          const draft = names[type.id] ?? type.name;
          const changed = draft.trim() !== type.name && draft.trim() !== '';
          return (
            <Row key={type.id} $inactive={!type.active}>
              <Input
                value={draft}
                maxLength={80}
                aria-label={`Nome de ${type.name}`}
                onChange={(e) => setNames((current) => ({ ...current, [type.id]: e.target.value }))}
                onPressEnter={() => rename(type)}
                suffix={changed && <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => rename(type)} aria-label="Salvar o nome" />}
              />
              <Uses>{type.uses ? `${type.uses} lançamento${type.uses > 1 ? 's' : ''}` : 'sem uso'}</Uses>
              <Flex gap={6} align="center">
                <Tooltip title={type.active ? 'Ativo: aparece na escolha' : 'Desativado: não aparece na escolha'}>
                  <Switch size="small" checked={type.active} onChange={(checked) => toggle(type, checked)} aria-label={`Ativar ${type.name}`} />
                </Tooltip>
                <Tooltip title={type.uses ? 'Já usado em recebimentos: desative em vez de excluir' : 'Excluir'}>
                  <Button type="text" size="small" icon={<DeleteOutlined />} disabled={type.uses > 0} onClick={() => remove(type)} aria-label={`Excluir ${type.name}`} />
                </Tooltip>
              </Flex>
            </Row>
          );
        })}
      </List>
      <AddRow>
        <Input placeholder="Novo tipo de trabalho (ex.: Certidões negativas)" value={newName} maxLength={80} onChange={(e) => setNewName(e.target.value)} onPressEnter={add} />
        <Button type="primary" icon={<PlusOutlined />} loading={busy} disabled={!newName.trim()} onClick={add}>
          Adicionar
        </Button>
      </AddRow>
    </Modal>
  );
}
