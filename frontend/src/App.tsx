import { Spin } from 'antd';
import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import styled from 'styled-components';

import { useAuth } from '@/core/auth/authContext';
import { LoginPage } from '@/core/auth/LoginPage';
import { AppLayout } from '@/core/layout/AppLayout';
import { settingsRoutes } from '@/core/settings/routes';
import { MODULES } from '@/modules';

const Centered = styled.div`
  display: flex;
  min-height: 100vh;
  align-items: center;
  justify-content: center;
`;

// URLs com "#" (ex.: /#/projetos): o servidor entrega sempre a mesma página
const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to={MODULES[0].path} replace /> },
      ...MODULES.flatMap((m) => m.routes),
      // telas do sistema (não são módulos da navegação)
      ...settingsRoutes,
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

export function App() {
  const { session } = useAuth();

  if (session.status === 'checking') {
    return (
      <Centered>
        <Spin size="large" />
      </Centered>
    );
  }
  if (session.status === 'anonymous') {
    return <LoginPage notice={session.notice} />;
  }
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
