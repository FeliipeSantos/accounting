import { Layout, Menu } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { GlobalHeader } from '@/core/layout/GlobalHeader';
import { LayoutContext } from '@/core/layout/layoutContext';
import { buildMenuItems } from '@/core/layout/menuItems';
import { useVisibleModules } from '@/core/layout/useVisibleModules';
import { APP_VERSION, BrandMark, BRAND_NAME } from '@/core/ui';
import { MODULE_GROUPS, MODULES } from '@/modules';
import { palette } from '@/theme';

const COLLAPSED_KEY = 'side_nav_collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    // armazenamento indisponível: segue com o menu expandido
    return false;
  }
}

function saveCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // ignora falha ao guardar a preferência
  }
}

const Shell = styled(Layout)`
  min-height: 100vh;
`;

// menu fixo na altura da tela; o conteúdo rola ao lado
const Sider = styled(Layout.Sider)`
  &&& {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: auto;
    background: linear-gradient(180deg, ${palette.navy900} 0%, ${palette.navy950} 100%);
  }

  .ant-menu-dark,
  .ant-menu-dark .ant-menu-sub {
    background: transparent;
  }

  .ant-menu-dark .ant-menu-item,
  .ant-menu-dark .ant-menu-submenu-title {
    font-weight: 500;
    margin-inline: 12px;
    width: calc(100% - 24px);
  }

  /* itens dentro de um grupo: o recuo mostra que pertencem a ele */
  .ant-menu-dark.ant-menu-inline .ant-menu-sub.ant-menu-inline {
    background: transparent;
  }

  .ant-menu-dark .ant-menu-submenu-selected > .ant-menu-submenu-title {
    color: #fff;
  }

  /* recolhido, o grupo do módulo aberto fica destacado como um item selecionado */
  .ant-menu-dark.ant-menu-inline-collapsed > .menu-group-active > .ant-menu-submenu-title {
    background: ${palette.blue600};
    box-shadow: 0 6px 14px -6px rgba(30, 107, 230, 0.7);
  }

  .ant-menu-dark .ant-menu-item-selected {
    font-weight: 600;
    box-shadow: 0 6px 14px -6px rgba(30, 107, 230, 0.7);
  }

  .ant-menu-title-content {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* recolhido: o antd calcula o recuo com a margem padrão dele, e os ícones saíam do centro */
  .ant-menu-inline-collapsed > .ant-menu-item,
  .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-inline: 0 !important;
  }

  .ant-menu-inline-collapsed > .ant-menu-item .ant-menu-item-icon,
  .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-item-icon {
    margin: 0;
    line-height: 1;
  }

  .ant-menu-inline-collapsed > .ant-menu-item .ant-menu-title-content,
  .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-title-content,
  .ant-menu-inline-collapsed > .ant-menu-submenu > .ant-menu-submenu-title .ant-menu-submenu-arrow {
    display: none;
  }
`;

const SiderContent = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 22px 0 16px;
`;

const Brand = styled.div<{ $collapsed: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
  padding: ${({ $collapsed }) => ($collapsed ? '0 0 20px' : '0 24px 24px')};
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
`;

const SectionLabel = styled.span`
  display: block;
  padding: 0 24px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #c9d5e3;
`;

const Footer = styled.div`
  margin-top: auto;
  padding-top: 12px;
  text-align: center;
  font-size: 12px;
  font-weight: 500;
  color: rgba(201, 213, 227, 0.7);
  white-space: nowrap;

  &::before {
    content: '';
    display: block;
    height: 1px;
    margin: 0 24px 12px;
    background: rgba(255, 255, 255, 0.1);
  }
`;

// min-width 0: tabelas e o relatório largos rolam dentro da área, sem empurrar a página
const Content = styled(Layout.Content)`
  min-width: 0;
`;

// recolhido (ou em telas estreitas) o menu fica só com os ícones
const COLLAPSED_WIDTH = 72;

/** Authenticated shell: side menu with the system modules and the active module. */
export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsed);
  const [narrow, setNarrow] = useState(false);
  const collapsed = narrow || preferCollapsed;

  const visibleModules = useVisibleModules();
  const active = MODULES.find((m) => location.pathname.startsWith(m.path));
  const activeModule = active?.key;
  // o grupo do módulo aberto é marcado aqui: recolhido, o antd não monta os filhos e não sabe qual está ativo
  const menuItems = useMemo(
    () =>
      buildMenuItems(visibleModules, MODULE_GROUPS).map((entry) =>
        'children' in entry && entry.children.some((c) => c.key === activeModule) ? { ...entry, className: 'menu-group-active' } : entry,
      ),
    [visibleModules, activeModule],
  );

  // o grupo do módulo aberto começa aberto; os demais abrem e fecham com um clique
  const [openGroups, setOpenGroups] = useState<string[]>(() => (active?.group ? [active.group] : []));
  useEffect(() => {
    if (active?.group) setOpenGroups((current) => (current.includes(active.group as string) ? current : [...current, active.group as string]));
  }, [active?.group]);

  const layout = useMemo(
    () => ({
      collapsed,
      narrow,
      toggleMenu: () =>
        setPreferCollapsed((value) => {
          saveCollapsed(!value);
          return !value;
        }),
    }),
    [collapsed, narrow],
  );

  return (
    <LayoutContext.Provider value={layout}>
      <Shell hasSider>
        <Sider collapsible collapsed={collapsed} breakpoint="md" onBreakpoint={setNarrow} collapsedWidth={COLLAPSED_WIDTH} trigger={null} width={256} data-print-hide>
          <SiderContent>
            <Brand $collapsed={collapsed}>
              <BrandMark />
              {!collapsed && BRAND_NAME}
            </Brand>
            {!collapsed && <SectionLabel>Ferramentas</SectionLabel>}
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={activeModule ? [activeModule] : []}
              // recolhido, o antd mostra o grupo como menu flutuante: só controla os abertos no menu aberto
              {...(collapsed ? {} : { openKeys: openGroups, onOpenChange: setOpenGroups })}
              items={menuItems}
              onClick={({ key }) => navigate(MODULES.find((m) => m.key === key)?.path ?? '/')}
            />
            {/* sair da conta fica no menu do perfil, no cabeçalho global */}
            <Footer title={`Versão ${APP_VERSION}`}>{collapsed ? `v${APP_VERSION}` : `Version ${APP_VERSION}`}</Footer>
          </SiderContent>
        </Sider>
        <Content>
          <GlobalHeader />
          <Outlet />
        </Content>
      </Shell>
    </LayoutContext.Provider>
  );
}
