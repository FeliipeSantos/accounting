import { ExclamationCircleOutlined, InboxOutlined } from '@ant-design/icons';
import { Button, Flex, Skeleton, Typography } from 'antd';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { colors, radius, tones } from '@/theme';

const Box = styled.div`
  border: 1px dashed ${colors.borderStrong};
  border-radius: ${radius.card}px;
  background: ${colors.bgCard};
  padding: 32px 24px;
  text-align: center;
  color: ${colors.textMuted};
  font-size: 13px;
`;

const IconCircle = styled.span<{ $danger?: boolean }>`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 17px;
  background: ${({ $danger }) => ($danger ? tones.danger.bg : tones.info.bg)};
  color: ${({ $danger }) => ($danger ? tones.danger.fg : tones.info.fg)};
`;

const Title = styled.span`
  color: ${colors.textDark};
  font-weight: 600;
  font-size: 14px;
`;

interface EmptyStateProps {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}

/** Empty list: short title, what to do next and an optional action. */
export function EmptyState({ title, children, action, icon = <InboxOutlined /> }: EmptyStateProps) {
  return (
    <Box role="status">
      <Flex vertical align="center" gap={8}>
        <IconCircle aria-hidden>{icon}</IconCircle>
        {title && <Title>{title}</Title>}
        {children && <span>{children}</span>}
        {action}
      </Flex>
    </Box>
  );
}

/** Error with the server message and "Tentar novamente". */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Box role="alert">
      <Flex vertical align="center" gap={8}>
        <IconCircle $danger aria-hidden>
          <ExclamationCircleOutlined />
        </IconCircle>
        <Title>Não foi possível carregar os dados</Title>
        <Typography.Text type="secondary">{message}</Typography.Text>
        {onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
      </Flex>
    </Box>
  );
}

/** Content placeholder while the data loads. */
export function LoadingState({ rows = 3 }: { rows?: number }) {
  return <Skeleton active paragraph={{ rows }} />;
}
