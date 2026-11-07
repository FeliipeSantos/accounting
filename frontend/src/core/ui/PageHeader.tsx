import { ArrowLeftOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from 'antd';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { colors, fontSize } from '@/theme';

const Icon = styled.span`
  font-size: 30px;
  line-height: 1;
  color: ${colors.navy};
  display: grid;
  place-items: center;
  flex-shrink: 0;
`;

const Title = styled(Typography.Title)`
  &&& {
    color: ${colors.navy};
    font-size: ${fontSize.page}px;
    font-weight: 700;
    letter-spacing: -0.015em;
    line-height: 1.2;
    margin: 0;
    overflow-wrap: anywhere;
  }
`;

const Description = styled(Typography.Text)`
  &&& {
    font-size: ${fontSize.support}px;
  }
`;

const BackButton = styled(Button)`
  &&& {
    color: ${colors.navy};
  }
`;

const Heading = styled(Flex)`
  min-width: 0;
`;

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Outlined icon of the module, shown before the title. */
  icon?: ReactNode;
  /** Shows a back arrow before the title (pages opened from a list). */
  onBack?: () => void;
  backLabel?: string;
  /** Page-specific buttons, search and status on the right. */
  actions?: ReactNode;
}

/**
 * Title area of a page, below the global header: the only part that changes between
 * modules (title, description and page actions).
 */
export function PageHeader({ title, description, icon, onBack, backLabel = 'Voltar', actions }: PageHeaderProps) {
  return (
    <Flex justify="space-between" align="center" gap={16} wrap>
      <Heading align="center" gap={14}>
        {onBack && <BackButton type="text" icon={<ArrowLeftOutlined />} onClick={onBack} aria-label={backLabel} title={backLabel} />}
        {icon && <Icon aria-hidden>{icon}</Icon>}
        <div>
          <Title level={2}>{title}</Title>
          {description && <Description type="secondary">{description}</Description>}
        </div>
      </Heading>
      {actions && (
        <Flex gap={12} align="center" wrap>
          {actions}
        </Flex>
      )}
    </Flex>
  );
}
