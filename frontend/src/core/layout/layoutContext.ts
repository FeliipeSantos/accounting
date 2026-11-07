import { createContext, useContext } from 'react';

export interface LayoutContextValue {
  /** Side menu showing only the icons. */
  collapsed: boolean;
  /** Narrow screen: the menu stays collapsed. */
  narrow: boolean;
  toggleMenu: () => void;
}

export const LayoutContext = createContext<LayoutContextValue>({ collapsed: false, narrow: false, toggleMenu: () => undefined });

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}
