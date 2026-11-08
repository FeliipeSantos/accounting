import { BellOutlined, DownOutlined, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { Badge, Button, Dropdown, Flex, Popover } from 'antd';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useAuth } from '@/core/auth/authContext';
import { GlobalSearch } from '@/core/layout/GlobalSearch';
import { useLayout } from '@/core/layout/layoutContext';
import { countNew, isNew, ITEMS_PER_GROUP, type NotificationGroup, notificationsApi } from '@/core/layout/notifications';
import { IconCircle } from '@/core/ui';
import { MODULES } from '@/modules';
import { useModuleNotifications } from '@/modules/notifications';
import { colors, GLOBAL_HEADER_HEIGHT, palette, shadows } from '@/theme';

// barra fixa no topo da área de conteúdo: mesma altura e espaçamento em todas as rotas
const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 110;
  height: ${GLOBAL_HEADER_HEIGHT}px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 32px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: saturate(160%) blur(8px);
  border-bottom: 1px solid ${colors.border};

  @media (max-width: 768px) {
    padding: 0 16px;
  }

  @media print {
    display: none;
  }
`;

// botão do menu e busca do módulo aberto, à esquerda
const Start = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
`;

const IconButton = styled(Button)`
  &&& {
    color: ${colors.navy};
    font-size: 18px;
  }
`;

const UserButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  background: transparent;
  border: none;
  padding: 0 8px 0 4px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  color: ${colors.textDark};

  &:hover {
    background: ${colors.bgMuted};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }
`;

const Avatar = styled.span`
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: ${palette.blue600};
  color: #fff;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  flex-shrink: 0;
`;

const Hello = styled.span`
  font-size: 13.5px;
  font-weight: 500;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (max-width: 600px) {
    display: none;
  }
`;

const Caret = styled(DownOutlined)`
  font-size: 10px;
  color: ${colors.textSubtle};

  @media (max-width: 600px) {
    display: none;
  }
`;

const Panel = styled.div`
  width: min(360px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
`;

const PanelHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid ${colors.border};
  font-weight: 600;
  color: ${colors.navy};
`;

const GroupLabel = styled.div`
  padding: 10px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: ${colors.textSubtle};
`;

const Entry = styled.button`
  display: flex;
  gap: 12px;
  align-items: flex-start;
  width: 100%;
  padding: 10px 16px;
  background: transparent;
  border: none;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &:hover {
    background: ${colors.bgSubtle};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: -2px;
  }
`;

const EntryTexts = styled.span`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;

  b {
    font-size: 13px;
    font-weight: 600;
    color: ${colors.textDark};
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
  }

  small {
    font-size: 12px;
    color: ${colors.textMuted};
  }
`;

// entrada que chegou depois da última visita à central
const NewDot = styled.i`
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: ${colors.blue};
`;

const NewCount = styled.span`
  font-size: 12px;
  font-weight: 500;
  color: ${colors.blue};
`;

const When = styled.span`
  font-size: 11.5px;
  color: ${colors.textSubtle};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

const Empty = styled.div`
  padding: 28px 16px;
  text-align: center;
  color: ${colors.textMuted};
  font-size: 13px;
`;

const SeeAll = styled(Button)`
  &&& {
    margin: 4px 8px 8px;
  }
`;

const ProfileHead = styled.div`
  padding: 4px 4px 8px;
  display: flex;
  flex-direction: column;
  font-size: 12px;
  color: ${colors.textMuted};

  b {
    font-size: 13.5px;
    color: ${colors.textDark};
    font-weight: 600;
  }
`;

const PanelShadow = styled.div`
  background: ${colors.bgCard};
  border-radius: 12px;
  box-shadow: ${shadows.lg};
  overflow: hidden;
`;

interface NotificationPanelProps {
  groups: NotificationGroup[];
  /** Last visit before this opening: the entries after it are marked as new. */
  seenAt: string | null;
  onOpen: (path: string) => void;
}

function NotificationPanel({ groups, seenAt, onOpen }: NotificationPanelProps) {
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  const fresh = countNew(groups, seenAt);
  return (
    <PanelShadow>
      <Panel role="dialog" aria-label="Central de notificações">
        <PanelHead>
          <span>Notificações</span>
          {fresh > 0 && <NewCount>{fresh === 1 ? '1 nova' : `${fresh} novas`}</NewCount>}
        </PanelHead>
        {total === 0 && <Empty>Nenhuma notificação no momento.</Empty>}
        {groups
          .filter((g) => g.items.length > 0)
          .map((group) => (
            <div key={group.key}>
              <GroupLabel>{group.label}</GroupLabel>
              {group.items.slice(0, ITEMS_PER_GROUP).map((item) => (
                <Entry key={item.id} type="button" onClick={() => onOpen(item.path)}>
                  <IconCircle $tone={item.tone} $size={32} aria-hidden>
                    {item.icon}
                  </IconCircle>
                  <EntryTexts>
                    <b>{item.title}</b>
                    {item.description && <small>{item.description}</small>}
                  </EntryTexts>
                  {item.when && <When>{item.when}</When>}
                  {isNew(item, seenAt) && <NewDot aria-label="Nova" />}
                </Entry>
              ))}
              {group.seeAllPath && (
                <SeeAll type="link" size="small" onClick={() => onOpen(group.seeAllPath!)}>
                  Ver todas →
                </SeeAll>
              )}
            </div>
          ))}
      </Panel>
    </PanelShadow>
  );
}

/**
 * Global header of the application: one instance in the app shell, above every module.
 * Holds the menu button, the search of the open module, the notification center and the user profile; page titles,
 * tabs and actions start below it.
 */
export function GlobalHeader() {
  const { session, logout } = useAuth();
  const { narrow, toggleMenu } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const activeModule = MODULES.find((m) => location.pathname.startsWith(m.path));
  const groups = useModuleNotifications();
  const [open, setOpen] = useState(false);
  const user = session.status === 'authenticated' ? session.user : '';
  // última visita à central (no servidor) e a visita anterior, que marca as "novas" enquanto o painel está aberto
  const [seenAt, setSeenAt] = useState<string | null | undefined>(undefined);
  const [shownSince, setShownSince] = useState<string | null>(null);
  const total = seenAt === undefined ? 0 : countNew(groups, seenAt);
  const bellLabel = total ? `Notificações: ${total} nova(s)` : 'Notificações';

  useEffect(() => {
    if (!user) return;
    notificationsApi
      .seen()
      .then(setSeenAt)
      // sem a última visita, nada conta como novo: a central é só um aviso
      .catch(() => setSeenAt(new Date().toISOString()));
  }, [user]);

  function toggle(next: boolean) {
    setOpen(next);
    if (!next) return;
    // ao abrir, tudo passa a vista; o painel ainda destaca o que era novo
    setShownSince(seenAt ?? null);
    notificationsApi
      .markSeen()
      .then(setSeenAt)
      .catch(() => undefined);
  }

  function openPath(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <Bar>
      <Start>
        {!narrow && <IconButton type="text" icon={<MenuOutlined />} onClick={toggleMenu} aria-label="Recolher ou expandir o menu" title="Recolher ou expandir o menu" />}
        {activeModule?.search && <GlobalSearch moduleKey={activeModule.key} search={activeModule.search} />}
      </Start>
      <Flex align="center" gap={8}>
        <Popover
          open={open}
          onOpenChange={toggle}
          trigger="click"
          placement="bottomRight"
          arrow={false}
          styles={{ body: { padding: 0, background: 'transparent', boxShadow: 'none' } }}
          content={<NotificationPanel groups={groups} seenAt={shownSince} onOpen={openPath} />}
        >
          <Badge count={total} size="small" offset={[-4, 4]}>
            <IconButton type="text" shape="circle" icon={<BellOutlined />} aria-label={bellLabel} title={bellLabel} />
          </Badge>
        </Popover>
        <Dropdown
          trigger={['click']}
          placement="bottomRight"
          menu={{
            items: [
              {
                key: 'profile',
                icon: <UserOutlined />,
                label: (
                  <ProfileHead>
                    <span>Conectado como</span>
                    <b>{user}</b>
                  </ProfileHead>
                ),
                disabled: true,
              },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Sair da conta', onClick: () => void logout() },
            ],
          }}
        >
          <UserButton type="button" aria-label={`Perfil de ${user}`}>
            <Avatar aria-hidden>{user.slice(0, 2)}</Avatar>
            <Hello>Olá, {user}</Hello>
            <Caret aria-hidden />
          </UserButton>
        </Dropdown>
      </Flex>
    </Bar>
  );
}
