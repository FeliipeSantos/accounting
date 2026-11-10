import { LoginOutlined } from '@ant-design/icons';
import { Alert, Button, ConfigProvider, Form, Input, theme } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/authContext';
import { CHAR_LIMITS } from '@/core/hooks/useCharLimit';
import { BRAND_NAME, BrandLogo, VERSION_LABEL } from '@/core/ui';
import { FONT_FAMILY, palette } from '@/theme';

/** Dark login palette: deep navy background with a soft blue glow (the system's institutional blue). */
const login = {
  bg: '#070F1D',
  card: 'rgba(14, 24, 42, 0.78)',
  cardBorder: 'rgba(255, 255, 255, 0.09)',
  field: 'rgba(7, 15, 29, 0.55)',
  fieldBorder: 'rgba(255, 255, 255, 0.14)',
  text: '#EEF2F8',
  muted: '#93A1B5',
  label: '#D6DEEA',
  placeholder: '#5F6E84',
} as const;

// o tema escuro do antd só nesta tela: campos, alerta e botão seguem o fundo escuro
const loginTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: palette.blue600,
    colorBgContainer: login.field,
    colorBorder: login.fieldBorder,
    colorText: login.text,
    colorTextPlaceholder: login.placeholder,
    fontFamily: FONT_FAMILY,
    borderRadius: 10,
    controlHeightLG: 46,
    fontSizeLG: 15,
  },
};

const Screen = styled.main`
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 28px;
  min-height: 100vh;
  padding: 32px 16px;
  overflow: hidden;
  background:
    radial-gradient(ellipse 55% 45% at 32% 42%, rgba(30, 107, 230, 0.32), transparent 70%), radial-gradient(ellipse 45% 40% at 70% 68%, rgba(30, 107, 230, 0.16), transparent 70%),
    radial-gradient(ellipse 40% 35% at 72% 30%, rgba(148, 163, 184, 0.08), transparent 70%), ${login.bg};
`;

const Brand = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  color: ${login.text};
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.01em;
`;

const Card = styled.section`
  width: 100%;
  max-width: 440px;
  padding: 36px 32px 32px;
  border-radius: 16px;
  background: ${login.card};
  border: 1px solid ${login.cardBorder};
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(14px);

  @media (max-width: 480px) {
    padding: 28px 20px 24px;
  }
`;

const Title = styled.h1`
  margin: 0;
  color: ${login.text};
  font-size: 34px;
  font-weight: 400;
  letter-spacing: -0.02em;
  line-height: 1.15;
`;

const Subtitle = styled.p`
  margin: 10px 0 26px;
  color: ${login.muted};
  font-size: 14px;
`;

const ErrorAlert = styled(Alert)`
  margin-bottom: 18px;
`;

const LoginForm = styled(Form)`
  .ant-form-item {
    margin-bottom: 18px;
  }

  .ant-form-item-label {
    padding-bottom: 6px;
  }

  .ant-form-item-label > label {
    color: ${login.label};
    font-size: 13px;
    font-weight: 500;
  }
` as typeof Form;

// botão principal com o azul do sistema em degradê, como o laranja da referência
const SubmitButton = styled(Button)`
  &&& {
    margin-top: 6px;
    height: 46px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(180deg, #4c8df6 0%, ${palette.blue600} 100%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.2),
      0 10px 24px -10px rgba(30, 107, 230, 0.7);
    font-weight: 500;
  }

  &&&:not(:disabled):hover {
    background: linear-gradient(180deg, #5b98f8 0%, #2a76ec 100%);
  }
`;

const Version = styled.footer`
  color: ${login.muted};
  font-size: 12px;
  opacity: 0.8;
`;

interface LoginValues {
  username: string;
  password: string;
}

export function LoginPage({ notice }: { notice: string | null }) {
  const { login: signIn } = useAuth();
  const [error, setError] = useState<string | null>(notice);
  const [submitting, setSubmitting] = useState(false);

  async function submit({ username, password }: LoginValues) {
    setSubmitting(true);
    try {
      await signIn(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConfigProvider theme={loginTheme}>
      <Screen>
        <Brand>
          <BrandLogo size={32} />
        </Brand>
        <Card aria-labelledby="login-title">
          <Title id="login-title">Entrar</Title>
          <Subtitle>Acesse o {BRAND_NAME} com seu e-mail e senha.</Subtitle>
          {error && <ErrorAlert type="error" message={error} showIcon />}
          <LoginForm<LoginValues> layout="vertical" requiredMark={false} onFinish={submit}>
            <Form.Item label="E-mail" name="username" rules={[{ required: true, message: 'Informe o e-mail' }]}>
              {/* o limite continua valendo; só o contador não aparece */}
              <Input autoComplete="username" inputMode="email" size="large" maxLength={CHAR_LIMITS.username} autoFocus />
            </Form.Item>
            <Form.Item label="Senha" name="password" rules={[{ required: true, message: 'Informe a senha' }]}>
              <Input.Password autoComplete="current-password" size="large" maxLength={CHAR_LIMITS.password} />
            </Form.Item>
            <SubmitButton type="primary" htmlType="submit" size="large" block loading={submitting} icon={<LoginOutlined />}>
              Entrar
            </SubmitButton>
          </LoginForm>
        </Card>
        <Version>{VERSION_LABEL}</Version>
      </Screen>
    </ConfigProvider>
  );
}
