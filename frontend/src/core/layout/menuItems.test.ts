import { describe, expect, it } from 'vitest';

import { buildMenuItems } from '@/core/layout/menuItems';

const GROUPS = [{ key: 'ic', label: 'Inteligência Contábil', icon: null }];

describe('side menu items', () => {
  it('puts the modules of a group inside it, where its first module was', () => {
    const items = buildMenuItems(
      [
        { key: 'projects', label: 'Portal de Projetos', icon: null },
        { key: 'intelligence', label: 'Publicações', icon: null, group: 'ic' },
        { key: 'reforma', label: 'Calendário', icon: null, group: 'ic' },
      ],
      GROUPS,
    );
    expect(items.map((i) => [i.key, 'children' in i ? i.children.map((c) => c.key) : undefined])).toEqual([
      ['projects', undefined],
      ['ic', ['intelligence', 'reforma']],
    ]);
  });

  it('leaves out a group without visible modules', () => {
    expect(buildMenuItems([{ key: 'projects', label: 'Portal de Projetos', icon: null }], GROUPS).map((i) => i.key)).toEqual(['projects']);
  });
});
