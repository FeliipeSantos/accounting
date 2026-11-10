import styled from 'styled-components';

import { colors, radius, shadows } from '@/theme';

// quadro das preferências: uma linha por grupo (explicação à esquerda, opções à direita)
export const Panel = styled.section`
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
  overflow: hidden;
`;

export const Row = styled.div`
  display: grid;
  grid-template-columns: minmax(220px, 340px) minmax(0, 1fr);
  gap: 24px;
  padding: 24px;

  & + & {
    border-top: 1px solid ${colors.border};
  }

  @media (max-width: 900px) {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    padding: 20px 16px;
  }
`;

export const About = styled.div`
  display: flex;
  gap: 14px;
  align-items: flex-start;

  h2 {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 600;
    color: ${colors.navy};
  }

  p {
    margin: 0;
    font-size: 13px;
    color: ${colors.textMuted};
    line-height: 1.55;
  }
`;
