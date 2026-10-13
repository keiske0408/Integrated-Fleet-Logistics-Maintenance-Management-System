import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { safeStorage } from '@/lib/storage';
import { apiFetch } from '@/lib/api';

export type Theme = 'light' | 'dark';

export interface HSLColor {
  h: number;
  s: number;
  l: number;
}

export interface ThemeVars {
  background: HSLColor;
  foreground: HSLColor;
  card: HSLColor;
  cardForeground: HSLColor;
  primary: HSLColor;
  primaryForeground: HSLColor;
  secondary: HSLColor;
  muted: HSLColor;
  mutedForeground: HSLColor;
  border: HSLColor;
  accent: HSLColor;
  radius: number;
  fontSans: string;
}

export interface AppThemeState {
  dark: ThemeVars;
  light: ThemeVars;
}

export interface SystemThemeData {
  id: string;
  presetName?: string | null;
  dark: ThemeVars;
  light: ThemeVars;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export const DEFAULT_DARK_VARS: ThemeVars = {
  background: { h: 222, s: 28, l: 8 },
  foreground: { h: 210, s: 40, l: 96 },
  card: { h: 222, s: 24, l: 11 },
  cardForeground: { h: 210, s: 40, l: 96 },
  primary: { h: 217, s: 91, l: 60 },
  primaryForeground: { h: 222, s: 47, l: 11 },
  secondary: { h: 217, s: 33, l: 17 },
  muted: { h: 217, s: 28, l: 16 },
  mutedForeground: { h: 215, s: 20, l: 55 },
  border: { h: 217, s: 24, l: 20 },
  accent: { h: 217, s: 28, l: 16 },
  radius: 8,
  fontSans: 'Inter',
};

export const DEFAULT_LIGHT_VARS: ThemeVars = {
  background: { h: 220, s: 20, l: 97 },
  foreground: { h: 222, s: 47, l: 11 },
  card: { h: 0, s: 0, l: 100 },
  cardForeground: { h: 222, s: 47, l: 11 },
  primary: { h: 221, s: 83, l: 53 },
  primaryForeground: { h: 210, s: 40, l: 98 },
  secondary: { h: 215, s: 28, l: 93 },
  muted: { h: 215, s: 25, l: 93 },
  mutedForeground: { h: 215, s: 20, l: 46 },
  border: { h: 216, s: 20, l: 88 },
  accent: { h: 215, s: 25, l: 93 },
  radius: 8,
  fontSans: 'Inter',
};

export function applyThemeVariables(vars: Partial<ThemeVars>, mode: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const hsl = (c: HSLColor) => `${c.h} ${c.s}% ${c.l}%`;
  const isDark = mode === 'dark';
  const styleId = `fleet-theme-${mode}`;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }
  style.textContent = `
    ${isDark ? '.dark' : '.light'} {
      ${vars.background ? `--background: ${hsl(vars.background)};` : ''}
      ${vars.foreground ? `--foreground: ${hsl(vars.foreground)};` : ''}
      ${vars.card ? `--card: ${hsl(vars.card)};` : ''}
      ${vars.cardForeground ? `--card-foreground: ${hsl(vars.cardForeground)};` : ''}
      ${vars.primary ? `--primary: ${hsl(vars.primary)};` : ''}
      ${vars.primaryForeground ? `--primary-foreground: ${hsl(vars.primaryForeground)};` : ''}
      ${vars.secondary ? `--secondary: ${hsl(vars.secondary)};` : ''}
      ${vars.muted ? `--muted: ${hsl(vars.muted)};` : ''}
      ${vars.mutedForeground ? `--muted-foreground: ${hsl(vars.mutedForeground)};` : ''}
      ${vars.border ? `--border: ${hsl(vars.border)}; --input: ${hsl(vars.border)};` : ''}
      ${vars.accent ? `--accent: ${hsl(vars.accent)}; --accent-foreground: ${hsl(vars.foreground || { h: 0, s: 0, l: 100 })};` : ''}
      ${vars.radius !== undefined ? `--radius: ${vars.radius / 16}rem;` : ''}
    }
  `;
  if (vars.fontSans) {
    document.documentElement.style.setProperty('--font-sans', vars.fontSans);
    document.body.style.fontFamily = `'${vars.fontSans}', sans-serif`;
  }
}

export function applySavedThemeVariables() {
  try {
    const savedDark = safeStorage.getItem('fleet_theme_vars_dark');
    if (savedDark) {
      applyThemeVariables(JSON.parse(savedDark), 'dark');
    } else {
      applyThemeVariables(DEFAULT_DARK_VARS, 'dark');
    }

    const savedLight = safeStorage.getItem('fleet_theme_vars_light');
    if (savedLight) {
      applyThemeVariables(JSON.parse(savedLight), 'light');
    } else {
      applyThemeVariables(DEFAULT_LIGHT_VARS, 'light');
    }
  } catch {
    // Fallback silently if storage read or parse fails
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  systemTheme: SystemThemeData | null;
  isLoadingTheme: boolean;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Individual user preference for Dark vs Light mode (stored locally, not forced by admin)
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = safeStorage.getItem('fleet_theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // Fallback silently to dark theme
    }
    return 'dark';
  });

  const [systemTheme, setSystemTheme] = useState<SystemThemeData | null>(null);
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);

  // Fetch the authoritative organization theme from the database
  const refreshTheme = useCallback(async () => {
    setIsLoadingTheme(true);
    try {
      const res = await apiFetch('/api/theme');
      if (res.ok) {
        const data = (await res.json()) as SystemThemeData;
        if (data && data.dark && data.light) {
          setSystemTheme(data);
          safeStorage.setItem('fleet_theme_vars_dark', JSON.stringify(data.dark));
          safeStorage.setItem('fleet_theme_vars_light', JSON.stringify(data.light));
          applyThemeVariables(data.dark, 'dark');
          applyThemeVariables(data.light, 'light');
        }
      }
    } catch {
      // Fallback gracefully to locally cached or default variables
      applySavedThemeVariables();
    } finally {
      setIsLoadingTheme(false);
    }
  }, []);

  // 1. Immediately apply cached theme on mount to prevent any visual flicker
  useEffect(() => {
    applySavedThemeVariables();
    void refreshTheme();
  }, [refreshTheme]);

  // 2. React to user changing light vs dark mode
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    safeStorage.setItem('fleet_theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        setTheme,
        systemTheme,
        isLoadingTheme,
        refreshTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
