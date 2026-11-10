import type { ReactNode } from 'react';

/** What the navigation (top bar and mobile drawer) needs of a module and of a group (see src/modules). */
export interface MenuModule {
  key: string;
  label: string;
  icon: ReactNode;
  group?: string;
}

export interface MenuGroup {
  key: string;
  label: string;
  icon: ReactNode;
}

// type (não interface): o Menu do antd aceita objetos com atributos data-* extras
export type MenuLeaf = {
  key: string;
  label: string;
  icon: ReactNode;
  title: string;
};

/** A group: opens to show its modules. */
export type MenuParent = MenuLeaf & { children: MenuLeaf[] };

export type MenuEntry = MenuLeaf | MenuParent;

/**
 * Items of the navigation, in the order of the registry. Modules of a group go inside it,
 * and the group takes the place of its first module; a group with no visible module is left out.
 */
export function buildMenuItems(modules: MenuModule[], groups: MenuGroup[]): MenuEntry[] {
  const entries: MenuEntry[] = [];
  const opened = new Map<string, MenuParent>();
  modules.forEach(({ key, label, icon, group }) => {
    const item: MenuLeaf = { key, label, icon, title: label };
    const definition = group ? groups.find((g) => g.key === group) : undefined;
    if (!definition) {
      entries.push(item);
      return;
    }
    let parent = opened.get(definition.key);
    if (!parent) {
      parent = { key: definition.key, label: definition.label, icon: definition.icon, title: definition.label, children: [] };
      opened.set(definition.key, parent);
      entries.push(parent);
    }
    parent.children.push(item);
  });
  return entries;
}
