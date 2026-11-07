import { LogoutOutlined, ToolOutlined } from '@ant-design/icons';
import { Flex, Layout, Menu } from 'antd';
import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useAuth } from '@/core/auth/authContext';
import { MODULES } from '@/modules';
import { colors } from '@/theme';

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
  }
`;

const Brand = styled.div<{ $collapsed: boolean }>`
  color: #fff;
  font-weight: 700;
  font-size: 1rem;
  white-space: nowrap;
  padding: ${({ $collapsed }) => ($collapsed ? '20px 0' : '20px 24px')};
  text-align: ${({ $collapsed }) => ($collapsed ? 'center' : 'left')};
`;

const SectionLabel = styled.span`
  display: block;
  padding: 0 24px 4px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.45);
`;

// ocupa a altura do menu, menos o botão de recolher (48px) do Ant Design
const SiderContent = styled(Flex)`
  min-height: calc(100vh - 48px);
`;

const Footer = styled.div`
  border-top: 1px solid ${colors.navyDark};
`;

// min-width 0: tabelas e o relatório largos rolam dentro da área, sem empurrar a página
const Content = styled(Layout.Content)`
  min-width: 0;
`;

// em telas estreitas o menu fica só com os ícones
const NARROW_WIDTH = 56;

/** Authenticated shell: side menu with the system modules and the active module. */
export function AppLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [preferCollapsed, setPreferCollapsed] = useState(readCollapsed);
  const [narrow, setNarrow] = useState(false);
  const collapsed = narrow || preferCollapsed;

  const activeModule = MODULES.find((m) => location.pathname.startsWith(m.path))?.key;

  function toggle(value: boolean) {
    setPreferCollapsed(value);
    saveCollapsed(value);
  }

  return (
    <Shell hasSider>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={(value, type) => type === 'clickTrigger' && toggle(value)}
        breakpoint="md"
        onBreakpoint={setNarrow}
        collapsedWidth={narrow ? NARROW_WIDTH : 80}
        trigger={narrow ? null : undefined}
        width={240}
        data-print-hide
      >
        <SiderContent vertical justify="space-between">
          <div>
            <Brand $collapsed={collapsed}>
              <ToolOutlined /> {!collapsed && 'Ferramentas'}
            </Brand>
            {!collapsed && <SectionLabel>Módulos</SectionLabel>}
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={activeModule ? [activeModule] : []}
              items={MODULES.map((m) => ({ key: m.key, icon: m.icon, label: m.label, title: m.label }))}
              onClick={({ key }) => navigate(MODULES.find((m) => m.key === key)?.path ?? '/')}
            />
          </div>
          <Footer>
            <Menu
              theme="dark"
              mode="inline"
              selectable={false}
              items={[{ key: 'logout', icon: <LogoutOutlined />, label: 'Sair', title: 'Sair da conta' }]}
              onClick={() => void logout()}
            />
          </Footer>
        </SiderContent>
      </Sider>
      <Content>
        <Outlet />
      </Content>
    </Shell>
  );
}
