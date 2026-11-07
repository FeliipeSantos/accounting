import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { useState } from 'react';
import styled from 'styled-components';

import { errorMessage } from '@/core/api/client';
import { useAuth } from '@/core/auth/authContext';
import { useCharLimit } from '@/core/hooks/useCharLimit';
import { colors } from '@/theme';

const Screen = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, ${colors.navy} 0%, ${colors.navyDark} 100%);
`;

const LoginCard = styled(Card)`
  width: 100%;
  max-width: 420px;
  text-align: center;
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.2),
    0 10px 10px -5px rgba(0, 0, 0, 0.1);
`;

const Logo = styled.div`
  font-size: 3rem;
  margin-bottom: 12px;
`;

const Title = styled(Typography.Title)`
  &&& {
    color: ${colors.navy};
    margin-bottom: 24px;
  }
`;

const ErrorAlert = styled(Alert)`
  margin-bottom: 18px;
  text-align: left;
`;

const LoginForm = styled(Form)`
  text-align: left;
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
      <LoginCard styles={{ body: { padding: 40 } }}>
        <Logo aria-hidden>📋</Logo>
        <Title level={3}>Acesso ao Sistema</Title>
        {error && <ErrorAlert type="error" message={error} showIcon />}
        <LoginForm<LoginValues> layout="vertical" requiredMark={false} onFinish={submit}>
          <Form.Item label="Usuário" name="username" rules={[{ required: true, message: 'Informe o usuário' }]}>
            <Input placeholder="Seu usuário" autoComplete="username" size="large" {...usernameLimit} />
          </Form.Item>
          <Form.Item label="Senha" name="password" rules={[{ required: true, message: 'Informe a senha' }]}>
            <Input.Password placeholder="Sua senha" autoComplete="current-password" size="large" {...passwordLimit} />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={submitting}>
            Acessar Painel
          </Button>
        </LoginForm>
      </LoginCard>
    </Screen>
  );
}
