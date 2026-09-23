---
name: ui-ux
description: >-
  Provides UI/UX design guidelines, design system token patterns, shadcn/ui component
  conventions, responsive typography, color harmony, and micro-interactions.
  Use when designing user interfaces, styling components, improving UX, or creating polished enterprise dashboards.
---

# UI & UX Design System Skill

Establishes design standards, visual excellence principles, and user experience patterns tailored for the Fleet Logistics & Maintenance platform.

---

## 1. Design Aesthetics & Visual Hierarchy

1. **Enterprise Modern Palette**:
   - Avoid garish primary colors. Use refined HSL/Tailwind neutral tones with purposeful semantic accents:
     - **Primary/Brand**: Slate / Deep Navy (`#0F172A`, `#1E293B`)
     - **Fleet Active / Success**: Emerald / Forest Green (`#059669`, `#10B981`)
     - **PMS Due / Warning**: Amber / Warm Ochre (`#D97706`, `#F59E0B`)
     - **Critical Block / PR Gating Error**: Crimson / Rose (`#E11D48`, `#F43F5E`)
2. **Typography**:
   - Modern, legible sans-serif font stack (Inter, Outfit, or system sans).
   - Clear tabular numeral formatting (`font-mono` or `tabular-nums`) for vehicle mileage (KM readings), dates, call-in times, and currency amounts.
3. **Card & Surface Design**:
   - Subtle border contrast (`border-slate-200 dark:border-slate-800`), clean 8px-12px rounded corners, and soft elevation shadows (`shadow-sm`, `shadow-md`).

---

## 2. shadcn/ui Component Standards

1. **Directory Convention**:
   - Always check `components/ui/` first before creating or introducing new UI components.
   - Primitive components reside directly in `components/ui/` (e.g. `button.tsx`, `dialog.tsx`, `input.tsx`, `table.tsx`).
2. **Accessible by Default**:
   - Preserve Radix UI ARIA attributes, keyboard navigation (`Tab`, `Escape`, arrow keys), and focus visible ring indicators (`focus-visible:ring-2`).
3. **Interactive Feedback & Micro-animations**:
   - Use smooth transitions (`transition-all duration-150 ease-in-out`) on button hovers, dropdown triggers, and modal overlays.
   - Distinct loading states with disabled buttons and subtle spinner or skeleton animations.

---

## 3. Ergonomics for Fleet Operations

1. **High-Density Information Layouts**:
   - Dispatchers and fleet managers process multiple records concurrently. Design tables with compact row padding, sticky headers, and clear badge indicators.
2. **Status Badges & Gating Highlights**:
   - Prominently display vehicle PMS status:
     - `Compliant` (Green badge)
     - `PMS Due (5,000 KM reached)` (Amber badge)
     - `PMS Skipped - Incident Report Required` (Red badge)
   - Visually disable unlock actions when linked PR is not approved, with an informative tooltip pointing to the gating requirement.
3. **Responsive Adaptability**:
   - Clean breakdown from desktop multi-column logistics matrices down to tablet and mobile views for drivers and floor mechanics.
