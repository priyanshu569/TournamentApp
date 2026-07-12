import { createContext, useContext } from 'react';

type TabNavigationContextType = {
  goToTab: (key: string) => void;
};

export const TabNavigationContext = createContext<TabNavigationContextType | null>(null);

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}
