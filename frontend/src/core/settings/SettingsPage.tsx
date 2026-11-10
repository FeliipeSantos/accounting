import { CheckCircleFilled, DesktopOutlined, MoonOutlined, SettingOutlined, SlidersOutlined, SunOutlined } from '@ant-design/icons';
import { Tabs } from 'antd';
import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';

import { Page } from '@/core/layout/Page';
import { THEME_MODES, type ThemeMode, useThemeMode } from '@/core/theme/themeMode';
import { IconCircle } from '@/core/ui';
import { colors, radius, shadows } from '@/theme';

const THEME_ICONS: Record<ThemeMode, ReactNode> = {
  system: <DesktopOutlined />,
  light: <SunOutlined />,
  dark: <MoonOutlined />,
};

// quadro das preferências: uma linha por grupo (explicação à esquerda, opções à direita)
const Panel = styled.section`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
  overflow: hidden;
`;

const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 340px) minmax(0, 1fr);
  gap: 24px;
  padding: 24px;

  & + & {
    border-top: 1px solid ${colors.border};
  }

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 20px 16px;
  }
`;

const About = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;

  h2 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
    color: ${colors.navy};
  }

  p {
    margin: 0;
    font-size: 13px;
    color: ${colors.textMuted};
    line-height: 1.55;
  }
`;

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

/** Settings of the system. Each tab groups one kind of setting; "Preferências" is the first one. */
export function SettingsPage() {
  return (
    <Page icon={<SettingOutlined />} title="Ajustes" description="Gerencie a sua experiência no sistema.">
      <Tabs
        defaultActiveKey="preferencias"
        items={[
          {
            key: 'preferencias',
            label: 'Preferências',
            icon: <SlidersOutlined />,
            children: <Preferences />,
          },
        ]}
      />
    </Page>
  );
}
