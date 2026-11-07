import { DatePicker, Flex } from 'antd';
import styled from 'styled-components';

import { DATE_FORMAT, parseReportDate, setProjectField } from '@/modules/projects/model';
import { EditableText } from '@/modules/projects/report/EditableText';
import {
  CardLabel,
  CardText,
  DatesCard,
  DatesDivider,
  Dot,
  InfoCard,
  InfoRow,
  MetricLabel,
  MetricValue,
  ProjectName,
  ReportDate,
  ReportHeaderBar,
  StatusReportLabel,
} from '@/modules/projects/report/styles';
import type { Project, ProjectTextField } from '@/modules/projects/types';
import { colors } from '@/theme';

interface SectionProps {
  project: Project;
  editing: boolean;
  onChange: (project: Project) => void;
}

// seletor de data sem caixa: mantém fonte e cor do relatório (inclusive sobre o cabeçalho escuro)
const DateField = styled.span`
  display: inline-block;
  border-radius: 4px;
  transition: background-color 0.15s ease;

  &&& .ant-picker {
    padding: 0 4px;
    color: inherit;
  }

  &&& .ant-picker-input > input,
  &&& .ant-picker-suffix {
    font: inherit;
    color: inherit;
    letter-spacing: inherit;
  }

  &&& .ant-picker-input > input::placeholder {
    color: inherit;
    opacity: 0.6;
  }

  &:hover {
    background-color: rgba(26, 115, 232, 0.12);
    box-shadow: 0 0 0 2px rgba(26, 115, 232, 0.2);
  }

  &:focus-within {
    box-shadow: 0 0 0 2px ${colors.blue};
  }
`;

/** Date field: text outside edit mode, date picker (dd/mm/aaaa) in edit mode. */
function DateValue({ value, editing, label, onChange }: { value?: string; editing: boolean; label: string; onChange: (value: string) => void }) {
  if (!editing) return <>{value || '—'}</>;
  const parsed = parseReportDate(value);
  return (
    <DateField>
      <DatePicker
        size="small"
        variant="borderless"
        format={DATE_FORMAT}
        value={parsed}
        // data antiga fora do padrão continua visível até ser trocada
        placeholder={parsed ? undefined : value || 'dd/mm/aaaa'}
        onChange={(date) => onChange(date ? date.format(DATE_FORMAT) : '')}
        aria-label={label}
        allowClear={false}
      />
    </DateField>
  );
}

export function ReportHeader({ project, editing, onChange }: SectionProps) {
  const set = (field: ProjectTextField) => (value: string) => onChange(setProjectField(project, field, value.trim()));

  return (
    <ReportHeaderBar>
      <div>
        <ProjectName>
          <EditableText value={project.name} editing={editing} field="projectName" ariaLabel="Nome do projeto" onDark onCommit={set('name')} />
        </ProjectName>
        <Flex align="center" gap={8}>
          <StatusReportLabel>Status Report</StatusReportLabel>
          <StatusReportLabel aria-hidden>•</StatusReportLabel>
          <ReportDate>
            <DateValue value={project.reportDate} editing={editing} label="Data do relatório" onChange={set('reportDate')} />
          </ReportDate>
        </Flex>
      </div>
      <DatesCard>
        <div>
          <MetricLabel>Início</MetricLabel>
          <MetricValue>
            <DateValue value={project.startDate} editing={editing} label="Data de início" onChange={set('startDate')} />
          </MetricValue>
        </div>
        <DatesDivider />
        <div>
          <MetricLabel>Término</MetricLabel>
          <MetricValue>
            <DateValue value={project.endDate} editing={editing} label="Data de término" onChange={set('endDate')} />
          </MetricValue>
        </div>
      </DatesCard>
    </ReportHeaderBar>
  );
}

export function InfoCards({ project, editing, onChange }: SectionProps) {
  const set = (field: ProjectTextField) => (value: string) => onChange(setProjectField(project, field, value.trim()));

  return (
    <InfoRow>
      <InfoCard>
        <CardLabel>
          <Dot />
          Descrição do Projeto
        </CardLabel>
        <CardText>
          <EditableText value={project.description ?? ''} editing={editing} field="projectDescription" multiline ariaLabel="Descrição do projeto" onCommit={set('description')} />
        </CardText>
      </InfoCard>
      <InfoCard $muted>
        <CardLabel>Equipe</CardLabel>
        <CardText>
          <EditableText value={project.team ?? ''} editing={editing} field="projectTeam" multiline ariaLabel="Equipe" onCommit={set('team')} />
        </CardText>
      </InfoCard>
    </InfoRow>
  );
}
