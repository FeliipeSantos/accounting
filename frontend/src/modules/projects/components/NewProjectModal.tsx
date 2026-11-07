import { Form, Input, type InputRef, Modal } from 'antd';
import { useEffect, useRef } from 'react';

import { useCharLimit } from '@/core/hooks/useCharLimit';

interface NewProjectModalProps {
  open: boolean;
  saving: boolean;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function NewProjectModal({ open, saving, onCreate, onCancel }: NewProjectModalProps) {
  const [form] = Form.useForm<{ name: string }>();
  const nameLimit = useCharLimit('projectName');
  const inputRef = useRef<InputRef>(null);

  // foco já na abertura (se a animação não rodar) e de novo ao terminar de abrir
  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <Modal
      title="Novo projeto"
      open={open}
      okText="Criar projeto"
      cancelText="Cancelar"
      confirmLoading={saving}
      destroyOnHidden
      // o Modal move o foco para si ao terminar de abrir: o campo recebe o foco depois disso
      afterOpenChange={(visible) => visible && inputRef.current?.focus()}
      onOk={() => form.submit()}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical" requiredMark={false} onFinish={({ name }) => onCreate(name.trim())} preserve={false}>
        <Form.Item label="Nome do projeto" name="name" rules={[{ required: true, whitespace: true, message: 'Informe o nome do projeto' }]}>
          <Input ref={inputRef} placeholder="Ex.: Implantação do ERP" {...nameLimit} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
