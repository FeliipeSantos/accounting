import { Layout, Menu } from 'antd';
import { useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { GlobalHeader } from '@/core/layout/GlobalHeader';
import { LayoutContext } from '@/core/layout/layoutContext';
import { APP_VERSION, BrandMark, BRAND_NAME } from '@/core/ui';
import { MODULES } from '@/modules';
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

  .ant-menu-dark .ant-menu-item {
    font-weight: 500;
    margin-inline: 12px;
    width: calc(100% - 24px);
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

  const activeModule = MODULES.find((m) => location.pathname.startsWith(m.path))?.key;

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
        <Sider collapsible collapsed={collapsed} breakpoint="md" onBreakpoint={setNarrow} collapsedWidth={COLLAPSED_WIDTH} trigger={null} width={240} data-print-hide>
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
              items={MODULES.map(({ key, icon, label }) => ({ key, icon, label, title: label }))}
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
