import { forwardRef } from 'react';
import styled, { css } from 'styled-components';

import { statusTone } from '@/modules/projects/model';
import { type Accent, PRINT_PAGE_HEIGHT, PRINT_PAGE_WIDTH, PrintOnly, StatusBadge } from '@/modules/projects/report/styles';
import type { Project } from '@/modules/projects/types';
import { colors } from '@/theme';

const DetailPage = styled.div`
  break-before: page;
  width: ${PRINT_PAGE_WIDTH}px;
  min-height: ${PRINT_PAGE_HEIGHT}px;
  margin: 0 auto;
  padding: 40px 50px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  gap: 20px;
`;

const PrintPageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid ${colors.navy};
  padding-bottom: 15px;

  h2 {
    font-size: 1.8rem;
    font-weight: 700;
    color: ${colors.navy};
    margin: 0;
  }

  p {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: ${colors.textMuted};
    margin: 0;
  }
`;

const HeaderRight = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
`;

const ActivityName = styled.span`
  font-weight: 700;
  font-size: 1.1rem;
  color: ${colors.blue};
`;

const SectionTitle = styled.h3`
  font-size: 1.1rem;
  color: ${colors.navy};
  margin: 0 0 12px;
  border-bottom: 1px solid ${colors.border};
  padding-bottom: 6px;
`;

const Checklist = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 20px;
`;

const CheckItem = styled.li<{ $completed: boolean }>`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.9rem;
  padding: 8px 12px;
  background: ${({ $completed }) => ($completed ? colors.bgMuted : colors.bgSubtle)};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${({ $completed }) => ($completed ? colors.textMuted : colors.textDark)};

  span:first-child {
    font-size: 1.2rem;
    font-weight: bold;
    color: ${colors.blue};
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
`;

const accent = { blue: colors.blue, green: colors.green, orange: colors.orange } as const;

const ListCard = styled.div<{ $accent: Accent }>`
  border-radius: 8px;
  padding: 16px;
  border: 1px solid ${colors.border};
  border-top: 4px solid ${({ $accent }) => accent[$accent]};

  h4 {
    font-size: 0.9rem;
    margin: 0 0 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${({ $accent }) => accent[$accent]};
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    position: relative;
    padding-left: 12px;
  }

  li::before {
    content: '•';
    position: absolute;
    left: 0;
  }
`;

const WideBadge = styled(StatusBadge)`
  ${css`
    width: auto;
    font-size: 0.8rem;
    padding: 4px 12px;
  `}
`;

const LISTS = [
  { key: 'attentionPoints', title: 'Pontos de Atenção', accent: 'blue' },
  { key: 'projectImpacts', title: 'Impactos no Projeto', accent: 'green' },
  { key: 'actionPlans', title: 'Planos de Ação', accent: 'orange' },
] as const;

/**
 * One printed page per activity with details (checklist and lists), after the report.
 * Activities with nothing to detail are skipped (no blank pages).
 */
export const PrintPages = forwardRef<HTMLDivElement, { project: Project }>(function PrintPages({ project }, ref) {
  const detailed = project.activities.filter(
    (a) => a.subActivities.length || a.attentionPoints.length || a.projectImpacts.length || a.actionPlans.length,
  );

  return (
    <PrintOnly ref={ref}>
      {detailed.map((activity) => (
        <DetailPage key={activity.id} data-print-page>
          <PrintPageHeader>
            <div>
              <h2>{project.name}</h2>
              <p>DETALHAMENTO DA ATIVIDADE</p>
            </div>
            <HeaderRight>
              <ActivityName>{activity.name}</ActivityName>
              <WideBadge $tone={statusTone(activity.status)}>
                {activity.status} ({activity.progress}%)
              </WideBadge>
            </HeaderRight>
          </PrintPageHeader>
          {activity.subActivities.length > 0 && (
            <section>
              <SectionTitle>Subatividades</SectionTitle>
              <Checklist>
                {activity.subActivities.map((sub, index) => (
                  <CheckItem key={index} $completed={sub.completed}>
                    <span>{sub.completed ? '☑' : '☐'}</span>
                    <span>{sub.name}</span>
                  </CheckItem>
                ))}
              </Checklist>
            </section>
          )}
          <Grid>
            {LISTS.filter(({ key }) => activity[key].length).map(({ key, title, accent: tone }) => (
              <ListCard key={key} $accent={tone}>
                <h4>{title}</h4>
                <ul>
                  {activity[key].map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </ListCard>
            ))}
          </Grid>
        </DetailPage>
      ))}
    </PrintOnly>
  );
});
