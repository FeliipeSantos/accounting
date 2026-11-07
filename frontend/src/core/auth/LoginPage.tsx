import { Alert, Button, Card, Divider, Flex, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/authContext';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { BRAND_NAME, BrandMark } from '@/core/ui';
import { colors, palette, shadows } from '@/theme';

const Screen = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background: ${palette.navy900};
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 400px;
  box-shadow: ${shadows.lg};
`;

// marca do sistema sobre um quadro azul-marinho, como no menu lateral
const Mark = styled.span`
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: ${palette.navy900};
  display: grid;
  place-items: center;
`;

const Title = styled(Typography.Title)`
  &&& {
    color: ${colors.navy};
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 0;
  }
`;

const ErrorAlert = styled(Alert)`
  margin-bottom: 16px;
`;

// rótulos pequenos em caixa alta, como no restante do sistema
const LoginForm = styled(Form)`
  .ant-form-item-label > label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: ${colors.textMuted};
  }
` as typeof Form;

interface LoginValues {
  username: string;
  password: string;
}

export function LoginPage({ notice }: { notice: string | null }) {
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(notice);
  const [submitting, setSubmitting] = useState(false);
  const usernameLimit = useCharLimit('username');
  const passwordLimit = useCharLimit('password');

  async function submit({ username, password }: LoginValues) {
    setSubmitting(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <LoginCard styles={{ body: { padding: 32 } }}>
        <Flex vertical gap={12} align="flex-start">
          <Mark aria-hidden>
            <BrandMark />
          </Mark>
          <div>
            <Title level={3}>Acesso ao sistema</Title>
            <Typography.Text type="secondary">{BRAND_NAME}</Typography.Text>
          </div>
        </Flex>
        <Divider />
        {error && <ErrorAlert type="error" message={error} showIcon />}
        <LoginForm<LoginValues> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item label="Usuário" name="username" rules={[{ required: true, message: 'Informe o usuário' }]}>
            <Input placeholder="Seu usuário" autoComplete="username" size="large" {...usernameLimit} />
          </Form.Item>
          <Form.Item label="Senha" name="password" rules={[{ required: true, message: 'Informe a senha' }]}>
            <Input.Password placeholder="Sua senha" autoComplete="current-password" size="large" {...passwordLimit} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Entrar
          </Button>
        </LoginForm>
      </LoginCard>
    </Screen>
  );
}
