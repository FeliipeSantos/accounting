import { Button, Result, Skeleton } from 'antd';
import type { ReactNode } from 'react';

import type { LoadState } from '@/core/hooks/useLoad';

/** Loading skeleton, error with "Tentar novamente", or the content when the data arrived. */
export function ViewState<T>({ state, children }: { state: LoadState<T>; children: (data: T) => ReactNode }) {
  if (state.error) {
    return (
      <Result
        status="warning"
        title={`Não foi possível carregar os dados: ${state.error}`}
        extra={
          <Button type="primary" onClick={state.reload}>
            Tentar novamente
          </Button>
        }
      />
    );
  }
  if (state.data === undefined) return <Skeleton active />;
  return <>{children(state.data)}</>;
}
