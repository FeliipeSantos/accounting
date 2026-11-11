import { CheckCircleFilled, DesktopOutlined, MoonOutlined, SettingOutlined, SunOutlined, UserOutlined } from '@ant-design/icons';
import { Tabs } from 'antd';
import { Plug, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled, { css } from 'styled-components';

import { Page } from '@/core/layout/Page';
import { IntegrationsSettings } from '@/core/settings/IntegrationsSettings';
import { About, Panel, Row } from '@/core/settings/layout';
import { ProfileSettings } from '@/core/settings/ProfileSettings';
import { THEME_MODES, type ThemeMode, useThemeMode } from '@/core/theme/themeMode';
import { IconCircle } from '@/core/ui';
import { colors, radius } from '@/theme';

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
  system: <DesktopOutlined />,
  light: <SunOutlined />,
  dark: <MoonOutlined />,
};

const Options = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Option = styled.button<{ $selected: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-radius: ${radius.card}px;
  border: 1px solid ${colors.border};
  background: ${colors.bgSubtle};
  color: ${colors.textDark};
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;

  &:hover {
    border-color: ${colors.borderStrong};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  ${({ $selected }) =>
    $selected &&
    css`
      border-color: ${colors.blue};
      background: ${colors.blueSelected};

      &:hover {
        border-color: ${colors.blue};
      }
    `}
`;

const OptionIcon = styled.span`
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  border: 1px solid ${colors.border};
  background: ${colors.bgCard};
  color: ${colors.textMuted};
  font-size: 15px;
`;

const OptionText = styled.span`
  display: flex;
  flex-direction: column;

  strong {
    font-size: 14px;
    font-weight: 600;
  }

  small {
    font-size: 12.5px;
    color: ${colors.textMuted};
  }
`;

const Check = styled(CheckCircleFilled)`
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 18px;
  color: ${colors.blue};
`;

/** "Preferências" tab: for now, the appearance of the system (Sistema / Claro / Escuro). */
function Preferences() {
  const { mode, setMode } = useThemeMode();
  return (
    <Panel aria-label="Preferências">
      <Row>
        <About>
          <IconCircle $tone="blue" $size={36} aria-hidden>
            <SunOutlined />
          </IconCircle>
          <div>
            <h2 id="appearance-title">Aparência</h2>
            <p>Escolha como o sistema aparece. A mudança vale na hora e fica salva neste navegador.</p>
          </div>
        </About>
        <Options role="radiogroup" aria-labelledby="appearance-title">
          {THEME_MODES.map(({ value, label, hint }) => {
            const selected = mode === value;
            return (
              <Option key={value} type="button" role="radio" aria-checked={selected} $selected={selected} onClick={() => setMode(value)}>
                <OptionIcon aria-hidden>{THEME_ICONS[value]}</OptionIcon>
                <OptionText>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </OptionText>
                {selected && <Check aria-hidden />}
              </Option>
            );
          })}
        </Options>
      </Row>
    </Panel>
  );
}

// a primeira aba é a que abre sem ?aba= no endereço
const TABS = ['perfil', 'preferencias', 'integracoes'] as const;
type SettingsTab = (typeof TABS)[number];

/** Settings of the system. Each tab groups one kind of setting; the open tab is in the address (?aba=preferencias). */
export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('aba');
  const tab: SettingsTab = TABS.find((key) => key === requested) ?? TABS[0];
  return (
    <Page icon={<SettingOutlined />} title="Ajustes" description="Gerencie a sua experiência e as integrações do sistema.">
      <Tabs
        activeKey={tab}
        onChange={(key) => setParams(key === TABS[0] ? {} : { aba: key }, { replace: true })}
        items={[
          {
            key: 'perfil',
            label: 'Perfil',
            icon: <UserOutlined />,
            children: <ProfileSettings />,
          },
          {
            key: 'preferencias',
            label: 'Preferências',
            // ícone da Lucide (o de controles do antd fica desalinhado); a classe anticon dá o mesmo espaço dos outros
            icon: (
              <span className="anticon" aria-hidden>
                <SlidersHorizontal size="1em" strokeWidth={2} />
              </span>
            ),
            children: <Preferences />,
          },
          {
            key: 'integracoes',
            label: 'Integrações',
            icon: (
              <span className="anticon" aria-hidden>
                <Plug size="1em" strokeWidth={2} />
              </span>
            ),
            children: <IntegrationsSettings />,
          },
        ]}
      />
    </Page>
  );
}
