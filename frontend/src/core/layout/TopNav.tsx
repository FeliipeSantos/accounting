import { DownOutlined } from '@ant-design/icons';
import { Drawer, Dropdown, Menu } from 'antd';
import styled, { css } from 'styled-components';

import type { MenuEntry } from '@/core/layout/menuItems';
import { BrandLogo, VERSION_LABEL } from '@/core/ui';
import { colors, radius, tones } from '@/theme';

// módulos no centro da barra do topo: um botão por módulo; grupos abrem os seus módulos num menu
const Nav = styled.nav`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
`;

const NavItem = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: ${radius.card}px;
  background: transparent;
  color: ${colors.textDark};
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;

  .anticon {
    font-size: 10px;
    color: ${colors.textSubtle};
  }

  &:hover {
    background: ${colors.bgMuted};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  /* módulo aberto: pílula azul, como o destaque da referência */
  ${({ $active }) =>
    $active &&
    css`
      background: ${colors.blueSelected};
      color: ${tones.info.fg};

      .anticon {
        color: ${tones.info.fg};
      }

      &:hover {
        background: ${colors.blueSelected};
      }
    `}
`;

interface NavProps {
  entries: MenuEntry[];
  /** Key of the module open now. */
  activeKey?: string;
  onNavigate: (moduleKey: string) => void;
}

/** Modules in the top bar (wide screens). */
export function TopNav({ entries, activeKey, onNavigate }: NavProps) {
  return (
    <Nav aria-label="Módulos">
      {entries.map((entry) => {
        if (!('children' in entry)) {
          const active = entry.key === activeKey;
          return (
            <NavItem key={entry.key} type="button" $active={active} aria-current={active ? 'page' : undefined} onClick={() => onNavigate(entry.key)}>
              {entry.label}
            </NavItem>
          );
        }
        const active = entry.children.some((child) => child.key === activeKey);
        return (
          <Dropdown
            key={entry.key}
            trigger={['click']}
            placement="bottom"
            menu={{
              selectable: true,
              selectedKeys: activeKey ? [activeKey] : [],
              items: entry.children.map((child) => ({ key: child.key, icon: child.icon, label: child.label })),
              onClick: ({ key }) => onNavigate(key),
            }}
          >
            <NavItem type="button" $active={active} aria-haspopup="menu">
              {entry.label}
              <DownOutlined aria-hidden />
            </NavItem>
          </Dropdown>
        );
      })}
    </Nav>
  );
}

const DrawerBody = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100%;

  .ant-menu {
    border-inline-end: none !important;
    background: transparent;
  }
`;

const DrawerVersion = styled.div`
  margin-top: auto;
  padding: 16px 24px;
  font-size: 12px;
  color: ${colors.textSubtle};
`;

const DrawerBrand = styled.div`
  color: ${colors.navy};
`;

interface MobileNavProps extends NavProps {
  open: boolean;
  onClose: () => void;
}

/** Modules in a side drawer (narrow screens), opened by the menu button of the top bar. */
export function MobileNav({ entries, activeKey, onNavigate, open, onClose }: MobileNavProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      width={280}
      title={
        <DrawerBrand>
          <BrandLogo size={24} />
        </DrawerBrand>
      }
      styles={{ body: { padding: '8px 0 0' } }}
    >
      <DrawerBody>
        <Menu
          mode="inline"
          selectedKeys={activeKey ? [activeKey] : []}
          defaultOpenKeys={entries.filter((e) => 'children' in e).map((e) => e.key)}
          items={entries.map((entry) =>
            'children' in entry
              ? { key: entry.key, icon: entry.icon, label: entry.label, children: entry.children.map(({ key, icon, label }) => ({ key, icon, label })) }
              : { key: entry.key, icon: entry.icon, label: entry.label },
          )}
          onClick={({ key }) => {
            onNavigate(key);
            onClose();
          }}
        />
        <DrawerVersion>{VERSION_LABEL}</DrawerVersion>
      </DrawerBody>
    </Drawer>
  );
}
