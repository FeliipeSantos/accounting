import { CheckCircleFilled, CopyOutlined, InboxOutlined } from '@ant-design/icons';
import { Button, Upload } from 'antd';
import styled from 'styled-components';

import { colors, radius } from '@/theme';

const Steps = styled.ol`
  list-style: none;
  margin: 12px 0 4px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const Step = styled.li`
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
`;

const Number = styled.span`
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  font-weight: 700;
  color: ${colors.blue};
  background: ${colors.blueSelected};
`;

const StepTitle = styled.div`
  font-weight: 600;
  color: ${colors.textDark};
  line-height: 26px;
`;

const StepText = styled.div`
  color: ${colors.textMuted};
  font-size: 13px;
  margin-top: 2px;
`;

const CnpjBox = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  padding: 6px 6px 6px 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;
  background: ${colors.bgSubtle};
  font-weight: 600;
  font-variant-numeric: tabular-nums;
`;

const Copied = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: ${colors.green};
`;

const Drop = styled(Upload.Dragger)`
  && {
    display: block;
    margin-top: 10px;
  }

  .ant-upload-drag-icon {
    margin-bottom: 4px !important;
    font-size: 30px;
    color: ${colors.blue};
  }

  .ant-upload-text {
    font-size: 14px !important;
    font-weight: 600;
  }

  .ant-upload-hint {
    font-size: 12px !important;
  }
`;

interface GenerateStepsProps {
  cnpj: string;
  period: string;
  copied: boolean;
  onCopy: () => void;
  onFile: (file: File) => void;
}

/** Content of the "Gerar" dialog: issue the guide on the PGMEI, then send its PDF. */
export function GenerateSteps({ cnpj, period, copied, onCopy, onFile }: GenerateStepsProps) {
  return (
    <Steps>
      <Step>
        <Number>1</Number>
        <div>
          <StepTitle>Emita a guia no PGMEI</StepTitle>
          <StepText>
            O PGMEI abriu em outra aba. Cole o CNPJ, clique em Continuar e emita a guia de <b>{period}</b>.
          </StepText>
          <CnpjBox>
            {cnpj}
            {copied ? (
              <Copied>
                <CheckCircleFilled /> copiado
              </Copied>
            ) : (
              <Button size="small" icon={<CopyOutlined />} onClick={onCopy}>
                Copiar
              </Button>
            )}
          </CnpjBox>
        </div>
      </Step>
      <Step>
        <Number>2</Number>
        <div>
          <StepTitle>Envie o PDF baixado</StepTitle>
          <StepText>O sistema confere o CNPJ e a competência, guarda o arquivo e lê o valor, o vencimento e a linha digitável.</StepText>
          <Drop
            accept="application/pdf,.pdf"
            showUploadList={false}
            maxCount={1}
            beforeUpload={(file) => {
              onFile(file);
              return Upload.LIST_IGNORE;
            }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Clique ou arraste o PDF da guia</p>
            <p className="ant-upload-hint">Arquivo PDF de até 1 MB</p>
          </Drop>
        </div>
      </Step>
    </Steps>
  );
}
