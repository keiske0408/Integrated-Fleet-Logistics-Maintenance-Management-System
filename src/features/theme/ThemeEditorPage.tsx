import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from './ThemeContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RotateCcw, Sun, Moon, Download, Upload, Check, Palette, Type, Layers, Sliders } from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HSLColor {
  h: number;
  s: number;
  l: number;
}

interface ThemeVars {
  // Core
  background: HSLColor;
  foreground: HSLColor;
  // Card
  card: HSLColor;
  cardForeground: HSLColor;
  // Primary
  primary: HSLColor;
  primaryForeground: HSLColor;
  // Secondary / Muted
  secondary: HSLColor;
  muted: HSLColor;
  mutedForeground: HSLColor;
  // Border / Input
  border: HSLColor;
  // Accent
  accent: HSLColor;
  // Radius
  radius: number;
  // Font
  fontSans: string;
}

interface AppThemeState {
  dark: ThemeVars;
  light: ThemeVars;
}

// ─── Defaults ──────────────────────────────────────────────────────────────────

const DEFAULT_DARK: ThemeVars = {
  background:      { h: 222, s: 28, l: 8 },
  foreground:      { h: 210, s: 40, l: 96 },
  card:            { h: 222, s: 24, l: 11 },
  cardForeground:  { h: 210, s: 40, l: 96 },
  primary:         { h: 217, s: 91, l: 60 },
  primaryForeground: { h: 222, s: 47, l: 11 },
  secondary:       { h: 217, s: 33, l: 17 },
  muted:           { h: 217, s: 28, l: 16 },
  mutedForeground: { h: 215, s: 20, l: 55 },
  border:          { h: 217, s: 24, l: 20 },
  accent:          { h: 217, s: 28, l: 16 },
  radius: 8,
  fontSans: 'Inter',
};

const DEFAULT_LIGHT: ThemeVars = {
  background:      { h: 220, s: 20, l: 97 },
  foreground:      { h: 222, s: 47, l: 11 },
  card:            { h: 0, s: 0, l: 100 },
  cardForeground:  { h: 222, s: 47, l: 11 },
  primary:         { h: 221, s: 83, l: 53 },
  primaryForeground: { h: 210, s: 40, l: 98 },
  secondary:       { h: 215, s: 28, l: 93 },
  muted:           { h: 215, s: 25, l: 93 },
  mutedForeground: { h: 215, s: 20, l: 46 },
  border:          { h: 216, s: 20, l: 88 },
  accent:          { h: 215, s: 25, l: 93 },
  radius: 8,
  fontSans: 'Inter',
};

// ─── Theme Presets ─────────────────────────────────────────────────────────────

interface Preset {
  name: string;
  emoji: string;
  dark: Partial<ThemeVars>;
  light: Partial<ThemeVars>;
}

const PRESETS: Preset[] = [
  {
    name: 'Ocean Blue (Default)',
    emoji: '🌊',
    dark: { primary: { h: 217, s: 91, l: 60 }, background: { h: 222, s: 28, l: 8 } },
    light: { primary: { h: 221, s: 83, l: 53 }, background: { h: 220, s: 20, l: 97 } },
  },
  {
    name: 'Forest Green',
    emoji: '🌿',
    dark: { primary: { h: 142, s: 76, l: 46 }, background: { h: 150, s: 20, l: 7 } },
    light: { primary: { h: 142, s: 70, l: 40 }, background: { h: 140, s: 20, l: 97 } },
  },
  {
    name: 'Sunset Orange',
    emoji: '🌅',
    dark: { primary: { h: 24, s: 95, l: 58 }, background: { h: 20, s: 20, l: 8 } },
    light: { primary: { h: 24, s: 90, l: 50 }, background: { h: 30, s: 20, l: 98 } },
  },
  {
    name: 'Amethyst Purple',
    emoji: '💜',
    dark: { primary: { h: 271, s: 80, l: 60 }, background: { h: 270, s: 20, l: 7 } },
    light: { primary: { h: 271, s: 75, l: 50 }, background: { h: 270, s: 15, l: 97 } },
  },
  {
    name: 'Rose Pink',
    emoji: '🌹',
    dark: { primary: { h: 344, s: 85, l: 60 }, background: { h: 345, s: 20, l: 8 } },
    light: { primary: { h: 344, s: 80, l: 52 }, background: { h: 350, s: 15, l: 97 } },
  },
  {
    name: 'Slate Mono',
    emoji: '⬜',
    dark: { primary: { h: 215, s: 25, l: 65 }, background: { h: 220, s: 15, l: 9 } },
    light: { primary: { h: 215, s: 20, l: 40 }, background: { h: 220, s: 10, l: 97 } },
  },
  {
    name: 'Teal Cyan',
    emoji: '🩵',
    dark: { primary: { h: 186, s: 80, l: 50 }, background: { h: 200, s: 25, l: 7 } },
    light: { primary: { h: 186, s: 75, l: 40 }, background: { h: 190, s: 20, l: 97 } },
  },
  {
    name: 'Ember Gold',
    emoji: '🔥',
    dark: { primary: { h: 45, s: 95, l: 55 }, background: { h: 30, s: 20, l: 7 } },
    light: { primary: { h: 45, s: 90, l: 48 }, background: { h: 40, s: 20, l: 97 } },
  },
];

const FONTS = ['Inter', 'Outfit', 'Plus Jakarta Sans', 'DM Sans', 'Geist', 'Roboto', 'Poppins', 'Nunito'];

const FONT_IMPORTS: Record<string, string> = {
  'Inter': 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'Outfit': 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap',
  'Plus Jakarta Sans': 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap',
  'DM Sans': 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap',
  'Geist': 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&display=swap',
  'Roboto': 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'Poppins': 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap',
  'Nunito': 'https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;500;600;700;800&display=swap',
};

// ─── Apply theme to DOM ────────────────────────────────────────────────────────

function hsl({ h, s, l }: HSLColor) { return `${h} ${s}% ${l}%`; }

function applyThemeVars(vars: ThemeVars, mode: 'dark' | 'light') {
  const root = document.documentElement;
  const isDark = mode === 'dark';

  // Inject <style> element
  const styleId = `fleet-theme-${mode}`;
  let style = document.getElementById(styleId) as HTMLStyleElement;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  }

  style.textContent = `
    ${isDark ? '.dark' : '.light'} {
      --background: ${hsl(vars.background)};
      --foreground: ${hsl(vars.foreground)};
      --card: ${hsl(vars.card)};
      --card-foreground: ${hsl(vars.cardForeground)};
      --primary: ${hsl(vars.primary)};
      --primary-foreground: ${hsl(vars.primaryForeground)};
      --secondary: ${hsl(vars.secondary)};
      --muted: ${hsl(vars.muted)};
      --muted-foreground: ${hsl(vars.mutedForeground)};
      --border: ${hsl(vars.border)};
      --input: ${hsl(vars.border)};
      --accent: ${hsl(vars.accent)};
      --accent-foreground: ${hsl(vars.foreground)};
      --radius: ${vars.radius / 16}rem;
    }
  `;

  // Font
  root.style.setProperty('--font-sans', vars.fontSans);
  document.body.style.fontFamily = `'${vars.fontSans}', sans-serif`;
  // Load font if needed
  const fontUrl = FONT_IMPORTS[vars.fontSans];
  if (fontUrl) {
    const linkId = `fleet-font-${vars.fontSans.replace(/\s+/g, '-')}`;
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId; link.rel = 'stylesheet'; link.href = fontUrl;
      document.head.appendChild(link);
    }
  }
}

// ─── Color Slider ──────────────────────────────────────────────────────────────

function ColorSlider({
  label, value, min, max, onChange, gradient,
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void;
  gradient?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono font-semibold text-foreground w-10 text-right">{value}{label === 'H' ? '°' : '%'}</span>
      </div>
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: gradient }}>
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        {/* Thumb indicator */}
        <div
          className="absolute top-0 h-3 w-3 rounded-full border-2 border-white shadow-lg bg-white pointer-events-none -translate-x-1/2"
          style={{ left: `${((value - min) / (max - min)) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ─── HSL Color Control ────────────────────────────────────────────────────────

function HSLControl({
  label, value, onChange,
}: {
  label: string; value: HSLColor; onChange: (c: HSLColor) => void;
}) {
  const preview = `hsl(${value.h}, ${value.s}%, ${value.l}%)`;
  return (
    <div className="space-y-2 p-3 rounded-xl bg-muted/30 border border-border">
      <div className="flex items-center gap-2.5 mb-1">
        <div
          className="h-5 w-5 rounded-md border border-border/60 shadow-sm shrink-0"
          style={{ background: preview }}
        />
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground font-mono ml-auto">
          hsl({value.h}, {value.s}%, {value.l}%)
        </span>
      </div>
      <ColorSlider
        label="H" value={value.h} min={0} max={360}
        onChange={(v) => onChange({ ...value, h: v })}
        gradient="linear-gradient(to right,hsl(0,90%,50%),hsl(60,90%,50%),hsl(120,90%,50%),hsl(180,90%,50%),hsl(240,90%,50%),hsl(300,90%,50%),hsl(360,90%,50%))"
      />
      <ColorSlider
        label="S" value={value.s} min={0} max={100}
        onChange={(v) => onChange({ ...value, s: v })}
        gradient={`linear-gradient(to right, hsl(${value.h},0%,${value.l}%), hsl(${value.h},100%,${value.l}%))`}
      />
      <ColorSlider
        label="L" value={value.l} min={0} max={100}
        onChange={(v) => onChange({ ...value, l: v })}
        gradient={`linear-gradient(to right, hsl(${value.h},${value.s}%,0%), hsl(${value.h},${value.s}%,50%), hsl(${value.h},${value.s}%,100%))`}
      />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Section = 'presets' | 'colors' | 'typography' | 'layout';

export function ThemeEditorPage() {
  const { theme: currentThemeMode, setTheme } = useTheme();

  const [themeState, setThemeState] = useState<AppThemeState>(() => {
    try {
      const savedDark = localStorage.getItem('fleet_theme_vars_dark');
      const savedLight = localStorage.getItem('fleet_theme_vars_light');
      return {
        dark: savedDark ? { ...DEFAULT_DARK, ...JSON.parse(savedDark) } : { ...DEFAULT_DARK },
        light: savedLight ? { ...DEFAULT_LIGHT, ...JSON.parse(savedLight) } : { ...DEFAULT_LIGHT },
      };
    } catch {
      return { dark: { ...DEFAULT_DARK }, light: { ...DEFAULT_LIGHT } };
    }
  });

  const [editMode, setEditMode] = useState<'dark' | 'light'>(currentThemeMode);
  const [section, setSection] = useState<Section>('presets');
  const [savedToast, setSavedToast] = useState(false);
  const [appliedPreset, setAppliedPreset] = useState<string | null>('Ocean Blue (Default)');

  // Synchronize editMode when theme changes from sidebar or elsewhere
  useEffect(() => {
    setEditMode(currentThemeMode);
  }, [currentThemeMode]);

  // When switching modes via tab, update editMode AND set the app theme so the whole UI switches live!
  const handleModeChange = (mode: 'dark' | 'light') => {
    setEditMode(mode);
    setTheme(mode);
  };

  const vars = themeState[editMode];

  // Apply to DOM whenever vars change
  useEffect(() => {
    applyThemeVars(themeState.dark, 'dark');
    applyThemeVars(themeState.light, 'light');
  }, [themeState]);

  const updateVars = useCallback((updates: Partial<ThemeVars>) => {
    setThemeState((prev) => ({
      ...prev,
      [editMode]: { ...prev[editMode], ...updates },
    }));
    setAppliedPreset(null);
  }, [editMode]);

  const updateColor = useCallback((key: keyof ThemeVars, value: HSLColor) => {
    updateVars({ [key]: value });
  }, [updateVars]);

  const applyPreset = (preset: Preset) => {
    setThemeState((prev) => ({
      dark: { ...prev.dark, ...preset.dark },
      light: { ...prev.light, ...preset.light },
    }));
    setAppliedPreset(preset.name);
  };

  const resetToDefault = () => {
    setThemeState({ dark: { ...DEFAULT_DARK }, light: { ...DEFAULT_LIGHT } });
    setAppliedPreset('Ocean Blue (Default)');
  };

  const handleSave = () => {
    // Persist to localStorage
    localStorage.setItem('fleet_theme_vars_dark', JSON.stringify(themeState.dark));
    localStorage.setItem('fleet_theme_vars_light', JSON.stringify(themeState.light));
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const exportTheme = () => {
    const blob = new Blob([JSON.stringify(themeState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'fleet-theme.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const importTheme = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.dark && parsed.light) {
          setThemeState(parsed);
          setAppliedPreset(null);
        }
      } catch {}
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const SECTIONS: { id: Section; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'presets', label: 'Presets', icon: Palette },
    { id: 'colors', label: 'Colors', icon: Layers },
    { id: 'typography', label: 'Typography', icon: Type },
    { id: 'layout', label: 'Layout', icon: Sliders },
  ];

  // Color entries for the Colors section
  const COLOR_FIELDS: { key: keyof ThemeVars; label: string }[] = [
    { key: 'background', label: 'Background' },
    { key: 'foreground', label: 'Foreground Text' },
    { key: 'card', label: 'Card / Surface' },
    { key: 'primary', label: 'Primary Accent' },
    { key: 'primaryForeground', label: 'Primary Text' },
    { key: 'muted', label: 'Muted Surface' },
    { key: 'mutedForeground', label: 'Muted Text' },
    { key: 'border', label: 'Border / Divider' },
    { key: 'accent', label: 'Hover Accent' },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Theme Editor</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Customize the full visual identity of the app — colors, fonts, spacing and more.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Import */}
          <label className="cursor-pointer">
            <input type="file" accept=".json" onChange={importTheme} className="hidden" />
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </span>
          </label>

          <Button variant="outline" onClick={exportTheme} className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>

          <Button variant="outline" onClick={resetToDefault} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            <span className="hidden sm:inline">Reset</span>
          </Button>

          <Button onClick={handleSave} className="gap-2">
            {savedToast ? <Check className="h-4 w-4" /> : null}
            {savedToast ? 'Saved!' : 'Apply Theme'}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-4">
          {/* Mode switcher + section nav */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Edit mode */}
            <div className="flex bg-muted/40 p-0.5 rounded-lg">
              {(['dark', 'light'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => handleModeChange(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    editMode === m ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'dark' ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
                  {m === 'dark' ? 'Dark Mode' : 'Light Mode'}
                </button>
              ))}
            </div>

            {/* Section tabs */}
            <div className="flex bg-muted/40 p-0.5 rounded-lg">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSection(s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      section === s.id ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Presets Section ── */}
          {section === 'presets' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {PRESETS.map((preset) => {
                const pColor = preset.dark?.primary as HSLColor | undefined;
                const pBg = preset.dark?.background as HSLColor | undefined;
                const isActive = appliedPreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    onClick={() => applyPreset(preset)}
                    className={`relative p-3 rounded-xl border text-left transition-all hover:scale-[1.03] hover:shadow-lg ${
                      isActive
                        ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                        : 'border-border hover:border-primary/40 bg-card'
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-2 right-2 h-4 w-4 bg-primary rounded-full flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    {/* Color preview swatch */}
                    <div
                      className="h-12 rounded-lg mb-3 relative overflow-hidden"
                      style={{
                        background: pBg ? `hsl(${pBg.h}, ${pBg.s}%, ${pBg.l}%)` : '#0d0d0d',
                      }}
                    >
                      {/* Primary color stripe */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-4 rounded-b-lg"
                        style={{
                          background: pColor ? `hsl(${pColor.h}, ${pColor.s}%, ${pColor.l}%)` : '#3b82f6',
                        }}
                      />
                      {/* Accent dots */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        {[0, -20, -40].map((offset) => (
                          <div
                            key={offset}
                            className="h-2 w-2 rounded-full opacity-80"
                            style={{
                              background: pColor
                                ? `hsl(${pColor.h + offset}, ${pColor.s}%, ${Math.min(80, pColor.l + 15)}%)`
                                : '#93c5fd',
                            }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-foreground">{preset.emoji} {preset.name}</p>
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Colors Section ── */}
          {section === 'colors' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Editing: <span className="font-semibold text-foreground capitalize">{editMode} mode</span> — changes apply instantly to the live app.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {COLOR_FIELDS.map(({ key, label }) => {
                  const val = vars[key] as HSLColor;
                  if (!val || typeof val === 'number' || typeof val === 'string') return null;
                  return (
                    <HSLControl
                      key={key}
                      label={label}
                      value={val}
                      onChange={(c) => updateColor(key, c)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Typography Section ── */}
          {section === 'typography' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Select a font to apply across the entire app.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FONTS.map((font) => {
                  const isActive = vars.fontSans === font;
                  return (
                    <button
                      key={font}
                      onClick={() => updateVars({ fontSans: font })}
                      className={`p-3 rounded-xl border text-left transition-all hover:scale-[1.02] ${
                        isActive ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      {isActive && <Check className="h-3 w-3 text-primary mb-1" />}
                      <p className="text-base font-semibold text-foreground" style={{ fontFamily: font }}>
                        Aa
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{font}</p>
                    </button>
                  );
                })}
              </div>

              {/* Font preview */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-2" style={{ fontFamily: vars.fontSans }}>
                <p className="text-sm text-muted-foreground">Live Preview — {vars.fontSans}</p>
                <h2 className="text-2xl font-bold text-foreground">Hulma Fleet Management</h2>
                <p className="text-base text-foreground">
                  Integrated vehicle operations, PMS scheduling, and procurement management.
                </p>
                <p className="text-sm text-muted-foreground">
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
                <div className="flex gap-2 pt-1">
                  <span className="text-xs font-light text-muted-foreground">Light</span>
                  <span className="text-xs font-normal text-muted-foreground">Regular</span>
                  <span className="text-xs font-medium text-foreground">Medium</span>
                  <span className="text-xs font-semibold text-foreground">Semibold</span>
                  <span className="text-xs font-bold text-foreground">Bold</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Layout Section ── */}
          {section === 'layout' && (
            <div className="space-y-5">
              {/* Border Radius */}
              <div className="bg-card border border-border rounded-xl p-5 space-y-4">
                <div className="flex justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Border Radius</h3>
                  <span className="text-sm font-mono text-primary">{vars.radius}px</span>
                </div>
                <input
                  type="range" min={0} max={24} step={1} value={vars.radius}
                  onChange={(e) => updateVars({ radius: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
                {/* Radius preview */}
                <div className="flex gap-3 flex-wrap">
                  {['bg-primary/20 border border-primary/30', 'bg-secondary border border-border', 'bg-muted border border-border'].map((cls, i) => (
                    <div
                      key={i}
                      className={`h-14 w-20 flex items-center justify-center text-xs font-medium ${cls}`}
                      style={{ borderRadius: `${vars.radius}px` }}
                    >
                      {i === 0 ? 'Button' : i === 1 ? 'Card' : 'Input'}
                    </div>
                  ))}
                </div>
                {/* Radius presets */}
                <div className="flex gap-2">
                  {[0, 4, 6, 8, 12, 16].map((r) => (
                    <button
                      key={r}
                      onClick={() => updateVars({ radius: r })}
                      className={`px-2.5 py-1 text-xs border transition-colors ${
                        vars.radius === r ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      }`}
                      style={{ borderRadius: `${r}px` }}
                    >
                      {r}px
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Preview Panel */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Preview
          </h3>

          {/* Mini app preview */}
          <div
            className="rounded-xl overflow-hidden border border-border shadow-xl"
            style={{
              background: `hsl(${vars.background.h}, ${vars.background.s}%, ${vars.background.l}%)`,
              color: `hsl(${vars.foreground.h}, ${vars.foreground.s}%, ${vars.foreground.l}%)`,
              borderRadius: `${vars.radius}px`,
              fontFamily: vars.fontSans,
            }}
          >
            {/* Mini sidebar + content */}
            <div className="flex h-48">
              {/* Sidebar */}
              <div
                className="w-14 flex flex-col items-center py-2 gap-2"
                style={{
                  background: `hsl(${vars.card.h}, ${vars.card.s}%, ${vars.card.l}%)`,
                  borderRight: `1px solid hsl(${vars.border.h}, ${vars.border.s}%, ${vars.border.l}%)`,
                }}
              >
                <div
                  className="h-5 w-5 rounded"
                  style={{
                    background: `hsl(${vars.primary.h}, ${vars.primary.s}%, ${vars.primary.l}%)`,
                    borderRadius: `${Math.min(vars.radius, 8)}px`,
                  }}
                />
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="h-1.5 w-6 rounded-full"
                    style={{
                      background: i === 0
                        ? `hsl(${vars.primary.h}, ${vars.primary.s}%, ${vars.primary.l}%)`
                        : `hsl(${vars.mutedForeground.h}, ${vars.mutedForeground.s}%, ${vars.mutedForeground.l}%,0.4)`,
                    }}
                  />
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 p-3 space-y-2">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="h-2 w-20 rounded-full" style={{ background: `hsl(${vars.foreground.h}, ${vars.foreground.s}%, ${vars.foreground.l}%)` }} />
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ background: `hsl(${vars.primary.h}, ${vars.primary.s}%, ${vars.primary.l}%)` }}
                  />
                </div>
                {/* Cards row */}
                <div className="grid grid-cols-2 gap-1.5">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="p-1.5 space-y-1"
                      style={{
                        background: `hsl(${vars.card.h}, ${vars.card.s}%, ${vars.card.l}%)`,
                        border: `1px solid hsl(${vars.border.h}, ${vars.border.s}%, ${vars.border.l}%)`,
                        borderRadius: `${vars.radius / 2}px`,
                      }}
                    >
                      <div className="h-1.5 w-6 rounded-full" style={{ background: `hsl(${vars.primary.h}, ${vars.primary.s}%, ${vars.primary.l}%)` }} />
                      <div className="h-1 w-10 rounded-full" style={{ background: `hsl(${vars.mutedForeground.h}, ${vars.mutedForeground.s}%, ${vars.mutedForeground.l}%, 0.5)` }} />
                    </div>
                  ))}
                </div>
                {/* Table row */}
                <div
                  className="p-2"
                  style={{
                    background: `hsl(${vars.card.h}, ${vars.card.s}%, ${vars.card.l}%)`,
                    border: `1px solid hsl(${vars.border.h}, ${vars.border.s}%, ${vars.border.l}%)`,
                    borderRadius: `${vars.radius / 2}px`,
                  }}
                >
                  {[...Array(2)].map((_, i) => (
                    <div key={i} className="flex gap-1.5 py-0.5">
                      <div className="h-1.5 w-8 rounded-full" style={{ background: `hsl(${vars.foreground.h}, ${vars.foreground.s}%, ${vars.foreground.l}%, 0.6)` }} />
                      <div className="h-1.5 w-12 rounded-full" style={{ background: `hsl(${vars.mutedForeground.h}, ${vars.mutedForeground.s}%, ${vars.mutedForeground.l}%, 0.4)` }} />
                    </div>
                  ))}
                </div>
                {/* Button */}
                <div
                  className="h-5 w-14 flex items-center justify-center"
                  style={{
                    background: `hsl(${vars.primary.h}, ${vars.primary.s}%, ${vars.primary.l}%)`,
                    borderRadius: `${vars.radius / 2}px`,
                  }}
                >
                  <div className="h-1.5 w-8 rounded-full bg-white/70" />
                </div>
              </div>
            </div>
          </div>

          {/* Color palette swatch row */}
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider font-semibold">Palette</p>
            <div className="flex gap-1.5 flex-wrap">
              {COLOR_FIELDS.map(({ key, label }) => {
                const val = vars[key] as HSLColor;
                if (!val || typeof val === 'number' || typeof val === 'string') return null;
                return (
                  <div key={key} title={label} className="text-center">
                    <div
                      className="h-6 w-6 rounded-md border border-border/40 shadow-sm"
                      style={{ background: `hsl(${val.h}, ${val.s}%, ${val.l}%)` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current values */}
          <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Current Settings</p>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Font</span>
                <span className="font-medium text-foreground">{vars.fontSans}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Border radius</span>
                <span className="font-mono text-foreground">{vars.radius}px</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Primary</span>
                <span className="font-mono text-primary">hsl({vars.primary.h}, {vars.primary.s}%, {vars.primary.l}%)</span>
              </div>
              {appliedPreset && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Preset</span>
                  <span className="text-emerald-400 font-medium text-[11px]">{appliedPreset}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save toast */}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 bg-card border border-border text-foreground text-sm rounded-xl shadow-2xl animate-slide-up flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          Theme applied and saved!
        </div>
      )}
    </div>
  );
}
