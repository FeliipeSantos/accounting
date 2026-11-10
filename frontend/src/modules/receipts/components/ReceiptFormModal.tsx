import { PlusOutlined } from '@ant-design/icons';
import { Button, Col, DatePicker, Form, Input, InputNumber, Modal, Row, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import styled from 'styled-components';

import { formatMoney } from '@/modules/clients/format';
import type { Client } from '@/modules/clients/types';
import { balanceState, LIMITS, MONTHLY_FEE, OTHER_SERVICE, PAYMENT_METHODS, preview, typeChoices } from '@/modules/receipts/format';
import type { PaymentMethod, Receipt, ReceiptInput, ServiceType } from '@/modules/receipts/types';
import { colors, radius, tones } from '@/theme';

const FullInputNumber = styled(InputNumber<number>)`
  width: 100%;
`;

const FullDatePicker = styled(DatePicker)`
  width: 100%;
`;

const Summary = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgSubtle};
  padding: 12px 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;

  span {
    font-size: 12px;
    color: ${colors.textMuted};
  }
`;

const SummaryValue = styled.strong<{ $tone: keyof typeof tones }>`
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  color: ${({ $tone }) => ($tone === 'neutral' ? colors.textDark : tones[$tone].fg)};
`;

const AddTypeRow = styled.div`
  display: flex;
  gap: 8px;
  padding: 8px 8px 4px;
  margin-top: 4px;
  border-top: 1px solid ${colors.border};
`;

const ClientOption = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;

  small {
    color: ${colors.textMuted};
  }
`;

interface FormValues {
  clientId: number;
  receivedOn: Dayjs;
  serviceTypeId: number;
  description?: string;
  period?: Dayjs | null;
  charged?: number | null;
  received?: number | null;
  method?: PaymentMethod;
  notes?: string;
}

function toInput(values: FormValues): ReceiptInput {
  return {
    clientId: values.clientId,
    receivedOn: values.receivedOn.format('YYYY-MM-DD'),
    serviceTypeId: values.serviceTypeId,
    description: values.description?.trim() || null,
    period: values.period ? values.period.format('YYYY-MM') : null,
    charged: values.charged ?? 0,
    received: values.received ?? 0,
    method: values.method ?? null,
    notes: values.notes?.trim() || null,
  };
}

function toForm(receipt: Receipt | null, types: ServiceType[], clientId?: number): Partial<FormValues> {
  if (!receipt) {
    // honorário do mês anterior, pago hoje: o caso mais comum
    const monthlyFee = types.find((t) => t.code === MONTHLY_FEE && t.active);
    return { clientId, receivedOn: dayjs(), serviceTypeId: monthlyFee?.id, period: monthlyFee ? dayjs().subtract(1, 'month') : null, method: 'pix' };
  }
  return {
    clientId: receipt.clientId,
    receivedOn: dayjs(receipt.receivedOn),
    serviceTypeId: receipt.serviceTypeId,
    description: receipt.description ?? undefined,
    period: receipt.period ? dayjs(`${receipt.period}-01`) : null,
    charged: receipt.charged,
    received: receipt.received,
    method: receipt.method ?? undefined,
    notes: receipt.notes ?? undefined,
  };
}

const money = { min: 0, max: 99999999.99, precision: 2, decimalSeparator: ',', prefix: 'R$' } as const;

interface ReceiptFormModalProps {
  open: boolean;
  /** Entry being edited; null creates a new one. */
  receipt: Receipt | null;
  /** Client already chosen for a new entry (from the client filter). */
  defaultClientId?: number;
  clients: Client[];
  /** Every service type (active and not), in display order. */
  types: ServiceType[];
  /** Adds a service type typed in the form; resolves the new type (or null when refused). */
  onAddType: (name: string) => Promise<ServiceType | null>;
  /** Current balance of each client (positive is credit), over all entries. */
  balanceOf: (clientId: number) => number;
  saving: boolean;
  onSave: (input: ReceiptInput) => void;
  onCancel: () => void;
}

/** Form of one entry: client, work done, amounts charged and received, and how the balance ends up. */
export function ReceiptFormModal({ open, receipt, defaultClientId, clients, types, onAddType, balanceOf, saving, onSave, onCancel }: ReceiptFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [newType, setNewType] = useState('');
  const [adding, setAdding] = useState(false);
  const clientId = Form.useWatch('clientId', form);
  const serviceTypeId = Form.useWatch('serviceTypeId', form);
  const serviceCode = types.find((t) => t.id === serviceTypeId)?.code ?? null;
  const isOther = serviceCode === OTHER_SERVICE;
  const charged = Form.useWatch('charged', form) ?? 0;
  const received = Form.useWatch('received', form) ?? 0;

  // saldo antes deste lançamento: ao editar, tira o efeito dele mesmo
  const previous = clientId ? balanceOf(clientId) - (receipt && receipt.clientId === clientId ? receipt.difference : 0) : 0;
  const { toPay, after } = preview(previous, charged, received);
  const before = balanceState(previous);
  const result = balanceState(after);
  const entry = balanceState(received - charged);

  // honorário mensal: sugere o valor cadastrado no cliente
  function fillFee(nextClientId?: number, nextTypeId?: number) {
    const id = nextClientId ?? form.getFieldValue('clientId');
    const typeId = nextTypeId ?? form.getFieldValue('serviceTypeId');
    const isMonthlyFee = types.find((t) => t.id === typeId)?.code === MONTHLY_FEE;
    const fee = clients.find((c) => c.id === id)?.monthlyFee;
    if (isMonthlyFee && fee && !form.getFieldValue('charged')) form.setFieldsValue({ charged: fee, received: form.getFieldValue('received') || fee });
  }

  async function addType() {
    const name = newType.trim();
    if (!name) return;
    setAdding(true);
    const created = await onAddType(name);
    setAdding(false);
    if (created) {
      setNewType('');
      form.setFieldsValue({ serviceTypeId: created.id });
    }
  }

  const activeFirst = [...clients].sort((a, b) => Number(a.status !== 'ativo') - Number(b.status !== 'ativo') || a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <Modal
      title={receipt ? 'Editar recebimento' : 'Novo recebimento'}
      open={open}
      width={680}
      okText={receipt ? 'Salvar alterações' : 'Lançar recebimento'}
      cancelText="Cancelar"
      confirmLoading={saving}
      destroyOnHidden
      onOk={() => form.submit()}
      onCancel={onCancel}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={toForm(receipt, types, defaultClientId)}
        preserve={false}
        onFinish={(values) => onSave(toInput(values))}
        onValuesChange={(changed: Partial<FormValues>) => {
          if ('clientId' in changed || 'serviceTypeId' in changed) fillFee(changed.clientId, changed.serviceTypeId);
        }}
      >
        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Form.Item label="Cliente" name="clientId" rules={[{ required: true, message: 'Escolha o cliente' }]}>
              <Select
                showSearch
                placeholder="Escolha o cliente"
                optionFilterProp="title"
                options={activeFirst.map((c) => {
                  const state = balanceState(balanceOf(c.id));
                  return {
                    value: c.id,
                    title: `${c.name} ${c.tradeName ?? ''}`,
                    label: (
                      <ClientOption>
                        <span>
                          {c.name}
                          {c.status === 'inativo' && <small> · inativo</small>}
                        </span>
                        {state.label !== 'Quitado' && <small>{state.text}</small>}
                      </ClientOption>
                    ),
                  };
                })}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Data do recebimento" name="receivedOn" rules={[{ required: true, message: 'Informe a data' }]}>
              <FullDatePicker format="DD/MM/YYYY" allowClear={false} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Trabalho realizado" name="serviceTypeId" rules={[{ required: true, message: 'Escolha o trabalho realizado' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="Escolha o trabalho"
                options={typeChoices(types, receipt?.serviceTypeId).map((t) => ({ value: t.id, label: t.active ? t.name : `${t.name} (desativado)` }))}
                popupRender={(menu) => (
                  <>
                    {menu}
                    <AddTypeRow>
                      <Input
                        size="small"
                        placeholder="Novo tipo de trabalho"
                        value={newType}
                        maxLength={80}
                        onChange={(e) => setNewType(e.target.value)}
                        // o Select não pode tratar as teclas digitadas aqui (Enter escolheria uma opção)
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addType();
                          }
                        }}
                      />
                      <Button size="small" type="primary" icon={<PlusOutlined />} loading={adding} disabled={!newType.trim()} onClick={addType}>
                        Adicionar
                      </Button>
                    </AddTypeRow>
                  </>
                )}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item label="Competência" name="period" tooltip="Mês a que o serviço se refere (ex.: honorário de outubro)">
              <FullDatePicker picker="month" format="MM/YYYY" placeholder="mm/aaaa" />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item label="Forma" name="method">
              <Select allowClear options={(Object.keys(PAYMENT_METHODS) as PaymentMethod[]).map((key) => ({ value: key, label: PAYMENT_METHODS[key] }))} />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="Descrição" name="description" rules={[{ required: isOther, whitespace: true, message: 'Descreva o serviço' }]} required={isOther}>
              <Input maxLength={LIMITS.description} placeholder={isOther ? 'Qual serviço foi feito' : 'Detalhes, se quiser (ex.: DAS de outubro, NF 123)'} />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item label="Valor cobrado" name="charged" tooltip="Quanto o serviço custou. Deixe zero para um adiantamento.">
              <FullInputNumber {...money} />
            </Form.Item>
          </Col>
          <Col xs={12}>
            <Form.Item label="Valor recebido" name="received" tooltip="Quanto o cliente pagou. O que passar do cobrado vira crédito.">
              <FullInputNumber {...money} />
            </Form.Item>
          </Col>
        </Row>

        {clientId && (
          <Summary>
            <SummaryItem>
              <span>Saldo antes</span>
              <SummaryValue $tone={before.tone}>{before.text}</SummaryValue>
              {previous > 0 && charged > 0 && <span>Com o crédito, pagaria {formatMoney(toPay)}</span>}
            </SummaryItem>
            <SummaryItem>
              <span>Este lançamento</span>
              <SummaryValue $tone={entry.tone}>
                {entry.label === 'Crédito'
                  ? `+${formatMoney(received - charged)} de crédito`
                  : entry.label === 'Em aberto'
                    ? `${formatMoney(charged - received)} em aberto`
                    : 'Pago exato'}
              </SummaryValue>
            </SummaryItem>
            <SummaryItem>
              <span>Saldo depois</span>
              <SummaryValue $tone={result.tone}>{result.text}</SummaryValue>
            </SummaryItem>
          </Summary>
        )}

        <Form.Item label="Observações" name="notes">
          <Input.TextArea maxLength={LIMITS.notes} autoSize={{ minRows: 2, maxRows: 5 }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
