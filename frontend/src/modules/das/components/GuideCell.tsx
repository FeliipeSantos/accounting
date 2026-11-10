import { CopyOutlined, FilePdfOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Flex, Space, Tooltip, Upload } from 'antd';
import styled from 'styled-components';

import { formatMoney } from '@/modules/clients/format';
import { dasApi } from '@/modules/das/api';
import { formatBarcodeLine, formatDay } from '@/modules/das/format';
import type { DasItem } from '@/modules/das/types';
import { colors } from '@/theme';

const Amount = styled.span`
  font-weight: 700;
  color: ${colors.textDark};
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const Muted = styled.span`
  color: ${colors.textMuted};
  font-size: 12px;
  white-space: nowrap;
`;

interface PdfPickerProps {
  label: string;
  onFile: (file: File) => void;
}

/** Button that picks the guide PDF (nothing is sent by antd: the page handles the file). */
function PdfPicker({ label, onFile }: PdfPickerProps) {
  return (
    <Upload
      accept="application/pdf,.pdf"
      showUploadList={false}
      maxCount={1}
      beforeUpload={(file) => {
        onFile(file);
        return Upload.LIST_IGNORE;
      }}
    >
      <Button size="small" icon={<UploadOutlined />}>
        {label}
      </Button>
    </Upload>
  );
}

interface GuideCellProps {
  item: DasItem;
  period: string;
  onFile: (file: File) => void;
  onCopyLine: (line: string) => void;
}

/** "Guia" column: amount and due date of the issued guide, its payment line and PDF, or the button to send the PDF. */
export function GuideCell({ item, period, onFile, onCopyLine }: GuideCellProps) {
  if (!item.hasPdf) {
    return <PdfPicker label="Enviar PDF" onFile={onFile} />;
  }
  return (
    <Flex vertical gap={6} align="flex-start">
      <Flex align="baseline" gap={8}>
        <Amount>{item.amount != null ? formatMoney(item.amount) : 'Valor não lido'}</Amount>
        {item.dueDate && <Muted>vence {formatDay(item.dueDate)}</Muted>}
      </Flex>
      <Flex gap={6} wrap>
        <Space.Compact size="small">
          {item.barcodeLine && (
            <Tooltip title={formatBarcodeLine(item.barcodeLine)}>
              <Button icon={<CopyOutlined />} onClick={() => onCopyLine(item.barcodeLine as string)}>
                Linha digitável
              </Button>
            </Tooltip>
          )}
          <Button icon={<FilePdfOutlined />} href={dasApi.pdfUrl(item.clientId, period)} aria-label={`Baixar o PDF do DAS de ${item.name}`}>
            PDF
          </Button>
        </Space.Compact>
        <Tooltip title="Trocar o PDF da guia">
          <span>
            <PdfPicker label="Trocar" onFile={onFile} />
          </span>
        </Tooltip>
      </Flex>
    </Flex>
  );
}
