import { BellOutlined, CopyOutlined, DownOutlined, HistoryOutlined, LogoutOutlined, MenuOutlined, MoonOutlined, SettingOutlined, SunOutlined, UserOutlined } from '@ant-design/icons';
import { App, Badge, Button, Dropdown, Flex, Popover } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useAuth } from '@/core/auth/authContext';
import { displayName } from '@/core/auth/profile';
import { buildMenuItems } from '@/core/layout/menuItems';
import { useLayout } from '@/core/layout/layoutContext';
import { MobileNav, TopNav } from '@/core/layout/TopNav';
import { useVisibleModules } from '@/core/layout/useVisibleModules';
import { SETTINGS_PATH } from '@/core/settings/routes';
import { countNew, isNew, ITEMS_PER_GROUP, type NotificationGroup, notificationsApi } from '@/core/layout/notifications';
import { useThemeMode } from '@/core/theme/themeMode';
import { APP_VERSION, BRAND_NAME, BrandLogo, IconCircle } from '@/core/ui';
import { UserAvatar } from '@/core/ui/UserAvatar';
import { MODULE_GROUPS, MODULES } from '@/modules';
import { useModuleNotifications } from '@/modules/notifications';
import { chrome, colors, GLOBAL_HEADER_HEIGHT, shadows } from '@/theme';

// barra fixa no topo: marca à esquerda, módulos no centro e ações à direita, em todas as rotas
const Bar = styled.header`
  position: sticky;
  top: 0;
  z-index: 110;
  height: ${GLOBAL_HEADER_HEIGHT}px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  padding: 0 32px;
  background: ${chrome.headerBg};
  backdrop-filter: saturate(160%) blur(8px);
  border-bottom: 1px solid ${colors.border};

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  @media (max-width: 768px) {
    padding: 0 16px;
    gap: 8px;
  }

  @media print {
    display: none;
  }
`;

// marca (e, em telas estreitas, o botão que abre os módulos), à esquerda
const Start = styled.div`
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const Actions = styled(Flex)`
  justify-self: end;
`;

const BrandButton = styled.button`
  display: inline-flex;
  align-items: center;
  padding: 4px;
  margin-left: -4px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: ${colors.navy};
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  @media (max-width: 480px) {
    /* em telas bem estreitas fica só o símbolo */
    & > span > span {
      display: none;
    }
  }
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

const Hello = styled.span`
  font-size: 12.5px;
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
  font-weight: 500;
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
    font-weight: 500;
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

// menu do usuário: cabeçalho com nome e e-mail, atalhos, versão e "Sair"
const UserMenu = styled.div`
  min-width: 260px;
  max-width: min(320px, calc(100vw - 32px));
  background: ${colors.bgElevated};
  border: 1px solid ${colors.border};
  border-radius: 12px;
  box-shadow: ${shadows.lg};
  overflow: hidden;

  .ant-dropdown-menu {
    background: transparent;
    box-shadow: none;
    padding: 6px;
  }
`;

const UserMenuHead = styled.div`
  padding: 14px 16px 12px;
  border-bottom: 1px solid ${colors.border};

  strong {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: ${colors.navy};
    overflow-wrap: anywhere;
  }

  span {
    display: block;
    margin-top: 2px;
    font-size: 12.5px;
    color: ${colors.textMuted};
    overflow-wrap: anywhere;
  }
`;

const CopyButton = styled.button`
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: ${colors.textSubtle};
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: ${colors.bgMuted};
    color: ${colors.textDark};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 1px;
  }
`;

const VersionRow = styled.span`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
`;

const VersionTag = styled.span`
  padding: 1px 8px;
  border-radius: 999px;
  border: 1px solid ${colors.border};
  background: ${colors.bgMuted};
  font-size: 11.5px;
  font-weight: 500;
  color: ${colors.textDark};
  font-variant-numeric: tabular-nums;
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
 * Holds the brand, the system modules (a menu button on narrow screens), the theme, notification, settings and profile; page titles,
 * tabs and actions start below it.
 */
export function GlobalHeader() {
  const { session, logout, profile } = useAuth();
  const { message } = App.useApp();
  const { resolved: resolvedTheme, setMode: setThemeMode } = useThemeMode();
  const themeToggleLabel = resolvedTheme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';
  const { narrow } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const activeModule = MODULES.find((m) => location.pathname.startsWith(m.path));
  const visibleModules = useVisibleModules();
  const navEntries = useMemo(() => buildMenuItems(visibleModules, MODULE_GROUPS), [visibleModules]);
  const [navOpen, setNavOpen] = useState(false);
  const goToModule = (key: string) => navigate(MODULES.find((m) => m.key === key)?.path ?? '/');
  const groups = useModuleNotifications();
  const [open, setOpen] = useState(false);
  const user = session.status === 'authenticated' ? session.user : '';
  // nome de exibição (Meu perfil); no topo, só o primeiro nome
  const shownName = profile ? displayName(profile) : user;
  const firstName = shownName.split(/\s+/)[0];
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

  function copyLogin() {
    navigator.clipboard
      .writeText(user)
      .then(() => message.success('E-mail copiado.'))
      .catch(() => message.error('Não foi possível copiar.'));
  }

  function openPath(path: string) {
    setOpen(false);
    navigate(path);
  }

  return (
    <Bar>
      <Start>
        {narrow && <IconButton type="text" icon={<MenuOutlined />} onClick={() => setNavOpen(true)} aria-label="Abrir os módulos" title="Módulos" />}
        <BrandButton type="button" onClick={() => navigate('/')} aria-label={`${BRAND_NAME}: página inicial`} title="Página inicial">
          <BrandLogo size={26} fontSize={19} />
        </BrandButton>
      </Start>
      {!narrow && <TopNav entries={navEntries} activeKey={activeModule?.key} onNavigate={goToModule} />}
      {narrow && <MobileNav entries={navEntries} activeKey={activeModule?.key} onNavigate={goToModule} open={navOpen} onClose={() => setNavOpen(false)} />}
      <Actions align="center" gap={8}>
        {/* atalho: alterna direto entre claro e escuro ("Sistema" fica em Ajustes) */}
        <IconButton
          type="text"
          shape="circle"
          icon={resolvedTheme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
          onClick={() => setThemeMode(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
        />
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
              { key: 'perfil', icon: <UserOutlined />, label: 'Meu perfil', onClick: () => navigate(SETTINGS_PATH) },
              { key: 'ajustes', icon: <SettingOutlined />, label: 'Ajustes', onClick: () => navigate(`${SETTINGS_PATH}?aba=preferencias`) },
              { type: 'divider' },
              {
                key: 'version',
                icon: <HistoryOutlined />,
                label: (
                  <VersionRow>
                    Versão
                    <VersionTag>v{APP_VERSION}</VersionTag>
                  </VersionRow>
                ),
                disabled: true,
              },
              { type: 'divider' },
              { key: 'logout', icon: <LogoutOutlined />, label: 'Sair', danger: true, onClick: () => void logout() },
            ],
          }}
          popupRender={(menu) => (
            <UserMenu>
              <UserMenuHead>
                <strong>
                  {shownName}
                  <CopyButton type="button" onClick={copyLogin} aria-label="Copiar e-mail de login" title="Copiar e-mail">
                    <CopyOutlined />
                  </CopyButton>
                </strong>
                {/* sem nome cadastrado, o título já é o e-mail */}
                {shownName !== user && <span>{user}</span>}
              </UserMenuHead>
              {menu}
            </UserMenu>
          )}
        >
          <UserButton type="button" aria-label={`Perfil de ${user}`}>
            <UserAvatar avatar={profile?.avatar} name={shownName} />
            <Hello>Olá, {firstName}</Hello>
            <Caret aria-hidden />
          </UserButton>
        </Dropdown>
      </Actions>
    </Bar>
  );
}
