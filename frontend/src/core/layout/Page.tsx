import type { ReactNode } from 'react';
import styled, { css } from 'styled-components';

import { PageContainer, PageHeader } from '@/core/ui';
import { colors, GLOBAL_HEADER_HEIGHT } from '@/theme';

// título da página logo abaixo do cabeçalho global; "sticky" mantém as ações visíveis ao rolar
const HeaderArea = styled.div<{ $sticky: boolean }>`
  ${({ $sticky }) =>
    $sticky &&
    css`
      position: sticky;
      top: ${GLOBAL_HEADER_HEIGHT}px;
      z-index: 100;
      background: ${colors.bgApp};
      margin: -24px -32px 0;
      padding: 24px 32px 16px;
      border-bottom: 1px solid ${colors.border};

      @media (max-width: 768px) {
        margin: -20px -16px 0;
        padding: 20px 16px 12px;
      }
    `}

  @media print {
    display: none;
  }
`;

interface PageProps {
  title: ReactNode;
  description?: ReactNode;
  /** Outlined icon of the module, shown before the title. */
  icon?: ReactNode;
  /** Back arrow before the title (pages opened from a list). */
  onBack?: () => void;
  backLabel?: string;
  /** Page-specific actions on the right of the title. */
  actions?: ReactNode;
  /** Keeps the title and actions visible while the page scrolls. */
  stickyHeader?: boolean;
  children: ReactNode;
}

/**
 * Module page: starts below the global header with the page title area (the only part
 * that varies between modules) and the content.
 */
export function Page({ title, description, icon, onBack, backLabel, actions, stickyHeader = false, children }: PageProps) {
  return (
    <PageContainer>
      <HeaderArea $sticky={stickyHeader}>
        <PageHeader title={title} description={description} icon={icon} onBack={onBack} backLabel={backLabel} actions={actions} />
      </HeaderArea>
      {children}
    </PageContainer>
  );
}
