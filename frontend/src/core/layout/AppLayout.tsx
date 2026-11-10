import { useEffect, useMemo, useState } from 'react';
import { Outlet } from 'react-router-dom';
import styled from 'styled-components';

import { GlobalHeader } from '@/core/layout/GlobalHeader';
import { LayoutContext } from '@/core/layout/layoutContext';
import { colors } from '@/theme';

/** Below this width the modules no longer fit in the top bar and move to the menu button. */
const NARROW_QUERY = '(max-width: 1100px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia(query).matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

const Shell = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${colors.bgApp};
`;

// min-width 0: tabelas e o relatório largos rolam dentro da área, sem empurrar a página
const Main = styled.main`
  flex: 1;
  min-width: 0;
`;

/** Authenticated shell: top bar with the brand, the system modules and the user actions, and the open module below. */
export function AppLayout() {
  const narrow = useMediaQuery(NARROW_QUERY);
  const layout = useMemo(() => ({ narrow }), [narrow]);

  return (
    <LayoutContext.Provider value={layout}>
      <Shell>
        <GlobalHeader />
        <Main>
          <Outlet />
        </Main>
      </Shell>
    </LayoutContext.Provider>
  );
}
