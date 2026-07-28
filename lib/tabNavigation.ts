import { createContext, useContext } from 'react';

type TabNavigationContextType = {
  goToTab: (key: string) => void;
  // The pager renders all 5 tabs as permanently-mounted siblings, so
  // switching tabs never changes React Navigation's own focus state --
  // useFocusEffect only fires on entering/leaving the "(tabs)" route as
  // a whole, not on internal pager swipes. Screens should watch this
  // value to know when they've actually become the visible tab.
  activeTab: string;
};

export const TabNavigationContext = createContext<TabNavigationContextType | null>(null);

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}
