import styled from 'styled-components';

import { colors, radius } from '@/theme';

/** Row of search, quick filters and sorting above a list. Wraps on narrow screens. */
export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
`;

/** Pushes the next toolbar items to the right. */
export const ToolbarSpacer = styled.span`
  flex: 1;
`;

/** Panel that holds the advanced filters of a list. */
export const FilterPanel = styled.div`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  padding: 14px 16px 2px;
`;

/** Bordered white frame for antd tables (header and rows come from the theme tokens). */
export const TableFrame = styled.div`
  min-width: 0;
  overflow: hidden;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;

  .ant-table-thead > tr > th {
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .ant-table-tbody > tr:last-child > td {
    border-bottom: none;
  }
`;
