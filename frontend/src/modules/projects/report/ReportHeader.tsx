import { DatePicker, Flex } from 'antd';
import dayjs from 'dayjs';

import { DATE_FORMAT, setProjectField } from '@/modules/projects/model';
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

interface SectionProps {
  project: Project;
  editing: boolean;
  onChange: (project: Project) => void;
}

/** Date field: text outside edit mode, date picker (dd/mm/aaaa) in edit mode. */
function DateValue({ value, editing, label, onChange }: { value?: string; editing: boolean; label: string; onChange: (value: string) => void }) {
  if (!editing) return <>{value || '—'}</>;
  const parsed = value ? dayjs(value, DATE_FORMAT, true) : null;
  return (
    <DatePicker
      size="small"
      format={DATE_FORMAT}
      value={parsed?.isValid() ? parsed : null}
      onChange={(date) => onChange(date ? date.format(DATE_FORMAT) : '')}
      aria-label={label}
      allowClear={false}
    />
  );
}

export function ReportHeader({ project, editing, onChange }: SectionProps) {
  const set = (field: ProjectTextField) => (value: string) => onChange(setProjectField(project, field, value.trim()));

  return (
    <ReportHeaderBar>
      <div>
        <ProjectName>
          <EditableText value={project.name} editing={editing} field="projectName" ariaLabel="Nome do projeto" size="large" onCommit={set('name')} />
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
