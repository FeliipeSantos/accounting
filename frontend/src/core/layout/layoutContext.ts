import { createContext, useContext } from 'react';

export interface LayoutContextValue {
  /** Narrow screen: the modules leave the top bar and open from the menu button. */
  narrow: boolean;
}

export const LayoutContext = createContext<LayoutContextValue>({ narrow: false });

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}
