import { useEffect, useState } from 'react';

import { MODULES, type ModuleDefinition } from '@/modules';

/**
 * Modules shown in the side menu. A module with `checkAccess` (e.g. a personal one) stays
 * hidden until the server confirms the current user may use it; the others always show.
 */
export function useVisibleModules(): ModuleDefinition[] {
  const [allowed, setAllowed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    MODULES.forEach((module) => {
      module
        .checkAccess?.()
        .then((ok) => active && setAllowed((current) => ({ ...current, [module.key]: ok })))
        .catch(() => active && setAllowed((current) => ({ ...current, [module.key]: false })));
    });
    return () => {
      active = false;
    };
  }, []);

  return MODULES.filter((module) => !module.checkAccess || allowed[module.key]);
}
