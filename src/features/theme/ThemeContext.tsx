import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applySavedThemeVariables() {
  try {
    const hsl = (c: any) => `${c.h} ${c.s}% ${c.l}%`;
    const apply = (vars: any, mode: 'dark' | 'light') => {
      if (!vars) return;
      const isDark = mode === 'dark';
      const styleId = `fleet-theme-${mode}`;
      let style = document.getElementById(styleId) as HTMLStyleElement;
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
          ${vars.accent ? `--accent: ${hsl(vars.accent)}; --accent-foreground: ${hsl(vars.foreground)};` : ''}
          ${vars.radius !== undefined ? `--radius: ${vars.radius / 16}rem;` : ''}
        }
      `;
      if (vars.fontSans) {
        document.documentElement.style.setProperty('--font-sans', vars.fontSans);
        document.body.style.fontFamily = `'${vars.fontSans}', sans-serif`;
      }
    };

    const savedDark = localStorage.getItem('fleet_theme_vars_dark');
    if (savedDark) apply(JSON.parse(savedDark), 'dark');
    const savedLight = localStorage.getItem('fleet_theme_vars_light');
    if (savedLight) apply(JSON.parse(savedLight), 'light');
  } catch {}
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('fleet_theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    applySavedThemeVariables();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('fleet_theme', theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
