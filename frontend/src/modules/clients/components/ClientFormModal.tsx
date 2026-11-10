import { Col, DatePicker, Divider, Form, Input, InputNumber, type InputRef, Modal, Row, Segmented, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useRef } from 'react';
import styled from 'styled-components';

import { CLIENT_STATUS, documentKind, formatDocument, LIMITS, normalizeDocument, REGIMES, STATES } from '@/modules/clients/format';
import type { Client, ClientInput, ClientStatus, Regime } from '@/modules/clients/types';
import { colors } from '@/theme';

const FullInputNumber = styled(InputNumber<number>)`
  width: 100%;
`;

const FullDatePicker = styled(DatePicker)`
  width: 100%;
`;

const Section = styled(Divider)`
  &&& {
    margin: 4px 0 14px;
    font-size: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${colors.textMuted};
  }
`;

interface FormValues {
  document: string;
  name: string;
  tradeName?: string;
  regime: Regime;
  status: ClientStatus;
  state?: string;
  city?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  monthlyFee?: number | null;
  startDate?: Dayjs | null;
  notes?: string;
}

const empty = (value: string | undefined) => value?.trim() || null;

function toInput(values: FormValues): ClientInput {
  return {
    document: normalizeDocument(values.document),
    name: values.name.trim(),
    tradeName: empty(values.tradeName),
    regime: values.regime,
    status: values.status,
    state: values.state ?? null,
    city: empty(values.city),
    stateRegistration: empty(values.stateRegistration),
    municipalRegistration: empty(values.municipalRegistration),
    contactName: empty(values.contactName),
    email: empty(values.email),
    phone: empty(values.phone),
    monthlyFee: values.monthlyFee ?? null,
    startDate: values.startDate ? values.startDate.format('YYYY-MM-DD') : null,
    notes: empty(values.notes),
  };
}

function toForm(client: Client | null): Partial<FormValues> {
  if (!client) return { status: 'ativo', regime: 'simples' };
  return {
    ...client,
    document: formatDocument(client.document),
    tradeName: client.tradeName ?? undefined,
    state: client.state ?? undefined,
    city: client.city ?? undefined,
    stateRegistration: client.stateRegistration ?? undefined,
    municipalRegistration: client.municipalRegistration ?? undefined,
    contactName: client.contactName ?? undefined,
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
    notes: client.notes ?? undefined,
    startDate: client.startDate ? dayjs(client.startDate) : null,
  };
}

const counter = (field: keyof typeof LIMITS) => ({ maxLength: LIMITS[field], showCount: LIMITS[field] > 100 });

interface ClientFormModalProps {
  open: boolean;
  /** Client being edited; null creates a new one. */
  client: Client | null;
  saving: boolean;
  onSave: (input: ClientInput) => void;
  onCancel: () => void;
}

/** Form to register or edit a client: identification, tax address, contact and contract. */
export function ClientFormModal({ open, client, saving, onSave, onCancel }: ClientFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const documentRef = useRef<InputRef>(null);
  const document = Form.useWatch('document', form) ?? '';
  const kind = documentKind(document);

  // o regime acompanha o tipo do documento: CPF é sempre Pessoa Física
  function syncRegime(changed: Partial<FormValues>) {
    if (changed.document === undefined) return;
    const next = documentKind(changed.document);
    const regime = form.getFieldValue('regime');
    if (next === 'pf' && regime !== 'pessoa_fisica') form.setFieldsValue({ regime: 'pessoa_fisica', tradeName: undefined });
    if (next === 'pj' && regime === 'pessoa_fisica') form.setFieldsValue({ regime: 'simples' });
  }

  const regimeOptions = (Object.keys(REGIMES) as Regime[])
    .filter((key) => (kind === 'pf' ? key === 'pessoa_fisica' : kind === 'pj' ? key !== 'pessoa_fisica' : true))
    .map((key) => ({ value: key, label: REGIMES[key] }));

  return (
    <Modal
      title={client ? 'Editar cliente' : 'Novo cliente'}
      open={open}
      width={760}
      okText={client ? 'Salvar alterações' : 'Cadastrar cliente'}
      cancelText="Cancelar"
      confirmLoading={saving}
      destroyOnHidden
      afterOpenChange={(visible) => visible && documentRef.current?.focus()}
      onOk={() => form.submit()}
      onCancel={onCancel}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={toForm(client)}
        onValuesChange={syncRegime}
        onFinish={(values) => onSave(toInput(values))}
        preserve={false}
      >
        <Section orientation="left" orientationMargin={0}>
          Identificação
        </Section>
        <Row gutter={16}>
          <Col xs={24} md={10}>
            <Form.Item
              label={kind === 'pf' ? 'CPF' : kind === 'pj' ? 'CNPJ' : 'CPF ou CNPJ'}
              name="document"
              normalize={(value: string) => formatDocument(value ?? '')}
              rules={[
                { required: true, message: 'Informe o CPF ou o CNPJ' },
                { validator: (_, value: string) => (!value || documentKind(value) ? Promise.resolve() : Promise.reject(new Error('CPF ou CNPJ inválido'))) },
              ]}
              validateTrigger="onBlur"
            >
              <Input ref={documentRef} placeholder="000.000.000-00 ou 00.000.000/0000-00" inputMode="text" autoComplete="off" />
            </Form.Item>
          </Col>
          <Col xs={24} md={14}>
            <Form.Item label={kind === 'pf' ? 'Nome' : 'Razão social'} name="name" rules={[{ required: true, whitespace: true, message: 'Informe o nome do cliente' }]}>
              <Input {...counter('name')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={10}>
            <Form.Item label="Nome fantasia" name="tradeName">
              <Input {...counter('tradeName')} disabled={kind === 'pf'} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Regime tributário" name="regime" rules={[{ required: true, message: 'Escolha o regime' }]}>
              <Select options={regimeOptions} />
            </Form.Item>
          </Col>
          <Col xs={24} md={6}>
            <Form.Item label="Situação" name="status">
              <Segmented<ClientStatus> block options={(Object.keys(CLIENT_STATUS) as ClientStatus[]).map((key) => ({ value: key, label: CLIENT_STATUS[key].label }))} />
            </Form.Item>
          </Col>
        </Row>

        <Section orientation="left" orientationMargin={0}>
          Endereço fiscal
        </Section>
        <Row gutter={16}>
          <Col xs={8} md={4}>
            <Form.Item label="UF" name="state">
              <Select allowClear showSearch options={STATES.map((uf) => ({ value: uf, label: uf }))} />
            </Form.Item>
          </Col>
          <Col xs={16} md={8}>
            <Form.Item label="Município" name="city">
              <Input {...counter('city')} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Inscrição estadual" name="stateRegistration">
              <Input {...counter('stateRegistration')} />
            </Form.Item>
          </Col>
          <Col xs={12} md={6}>
            <Form.Item label="Inscrição municipal" name="municipalRegistration">
              <Input {...counter('municipalRegistration')} />
            </Form.Item>
          </Col>
        </Row>

        <Section orientation="left" orientationMargin={0}>
          Contato
        </Section>
        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Responsável" name="contactName">
              <Input {...counter('contactName')} />
            </Form.Item>
          </Col>
          <Col xs={24} md={9}>
            <Form.Item label="E-mail" name="email" rules={[{ type: 'email', message: 'E-mail inválido' }]} validateTrigger="onBlur">
              <Input {...counter('email')} type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={7}>
            <Form.Item label="Telefone" name="phone">
              <Input {...counter('phone')} type="tel" placeholder="(00) 00000-0000" />
            </Form.Item>
          </Col>
        </Row>

        <Section orientation="left" orientationMargin={0}>
          Contrato
        </Section>
        <Row gutter={16}>
          <Col xs={12} md={8}>
            <Form.Item label="Honorário mensal" name="monthlyFee">
              <FullInputNumber prefix="R$" min={0} max={99999999.99} precision={2} decimalSeparator="," step={50} />
            </Form.Item>
          </Col>
          <Col xs={12} md={8}>
            <Form.Item label="Cliente desde" name="startDate">
              <FullDatePicker format="DD/MM/YYYY" placeholder="dd/mm/aaaa" />
            </Form.Item>
          </Col>
          <Col xs={24}>
            <Form.Item label="Observações" name="notes">
              <Input.TextArea {...counter('notes')} autoSize={{ minRows: 2, maxRows: 6 }} />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Modal>
  );
}
