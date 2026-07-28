import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, ThemeMode, ThemeColors } from '@/constants/theme';

const STORAGE_KEY = 'fragify_theme_preference';

type ThemeContextValue = {
  theme: ThemeMode;
  colors: ThemeColors;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  // Defaults to dark -- the app's original, only mode -- so existing
  // users see no change until they explicitly opt into light mode.
  const [theme, setThemeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      }
    });
  }, []);

  function setTheme(next: ThemeMode) {
    setThemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }

  function toggleTheme() {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }

  return (
    <ThemeContext.Provider value={{ theme, colors: Colors[theme], setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useAppTheme must be used within AppThemeProvider');
  return ctx;
}
