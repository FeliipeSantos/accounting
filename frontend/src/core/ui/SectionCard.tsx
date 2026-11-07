import { Card } from 'antd';
import type { ReactNode } from 'react';
import styled from 'styled-components';

import { shadows } from '@/theme';

const StyledCard = styled(Card)`
  box-shadow: ${shadows.sm};
  min-width: 0;

  /* título e controles quebram de linha em telas estreitas, sem sobrepor */
  .ant-card-head-wrapper {
    flex-wrap: wrap;
    gap: 8px 16px;
    padding-block: 10px;
  }

  .ant-card-head-title {
    flex: 0 0 auto;
  }

  .ant-card-extra {
    margin-inline-start: auto;
  }
`;

interface SectionCardProps {
  title?: ReactNode;
  /** Link or controls on the right of the title. */
  extra?: ReactNode;
  /** Content goes edge to edge (lists, tables). */
  flush?: boolean;
  children: ReactNode;
  className?: string;
}

/** White card with a title bar: the content block of every module. */
export function SectionCard({ title, extra, flush = false, children, className }: SectionCardProps) {
  return (
    <StyledCard className={className} title={title} extra={extra} styles={{ body: flush ? { padding: 0 } : undefined }}>
      {children}
    </StyledCard>
  );
}
