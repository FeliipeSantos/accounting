import { AppstoreOutlined } from '@ant-design/icons';

import { Page } from '@/core/layout/Page';
import { EmptyState } from '@/core/ui';

/** Visão Geral: home page of the application. What it shows is still to be defined. */
export function OverviewPage() {
  return (
    <Page icon={<AppstoreOutlined />} title="Visão Geral" description="Um resumo de tudo o que acontece no sistema.">
      <EmptyState title="Em construção">O conteúdo da Visão Geral ainda será definido.</EmptyState>
    </Page>
  );
}
