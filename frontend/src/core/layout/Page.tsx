import { Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { colors } from '@/theme';

const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 40px 20px;

  @media (max-width: 600px) {
    padding: 24px 16px;
  }
`;

const Header = styled(Flex)`
  padding-bottom: 24px;
  border-bottom: 1px solid ${colors.border};
  margin-bottom: 30px;
`;

const Title = styled(Typography.Title)`
  &&& {
    color: ${colors.navy};
    margin: 0;
  }
`;

interface PageProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Module page: title with subtitle, optional actions on the right, and the content. */
export function Page({ icon, title, subtitle, actions, children }: PageProps) {
  return (
    <Container>
      <Header justify="space-between" align="center" gap={16} wrap>
        <div>
          <Title level={2}>
            {icon} {title}
          </Title>
          <Typography.Text type="secondary">{subtitle}</Typography.Text>
        </div>
        {actions}
      </Header>
      {children}
    </Container>
  );
}
