import React from 'react';
import {
  Search,
  Plus,
  Type,
  AlignLeft,
  Hash,
  Calendar,
  Clock,
  ListFilter,
  CheckSquare,
  Layers,
  Database,
  Truck,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { FieldType, FormDefinition } from '../types';

export const PALETTE: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Text' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'select', label: 'Select' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'repeater', label: 'Repeater' },
  { type: 'lookup', label: 'LOV Lookup' },
  { type: 'entity_lookup', label: 'Fleet Vehicle' },
  { type: 'notice', label: 'Notice' },
];

export const PALETTE_META: Record<
  FieldType,
  { label: string; icon: React.ComponentType<{ className?: string }>; description: string }
> = {
  text: { label: 'Text Input', icon: Type, description: 'Single line text' },
  textarea: { label: 'Long Text', icon: AlignLeft, description: 'Multi-line notes' },
  number: { label: 'Number', icon: Hash, description: 'Numeric values' },
  date: { label: 'Date', icon: Calendar, description: 'Calendar picker' },
  time: { label: 'Time', icon: Clock, description: 'Time selector' },
  select: { label: 'Select Dropdown', icon: ListFilter, description: 'Predefined choices' },
  checkbox: { label: 'Checkbox', icon: CheckSquare, description: 'Yes / No toggle' },
  repeater: { label: 'Repeater Table', icon: Layers, description: 'Dynamic row items' },
  lookup: { label: 'LOV Lookup', icon: Database, description: 'System reference data' },
  entity_lookup: { label: 'Fleet Vehicle', icon: Truck, description: 'Vehicle / driver records' },
  notice: { label: 'Notice Banner', icon: Info, description: 'Read-only guidance' },
};

export interface FieldPaletteSidebarProps {
  mobileStudioView: 'canvas' | 'palette' | 'properties' | 'config';
  sidebarTab: 'palette' | 'outline';
  setSidebarTab: (tab: 'palette' | 'outline') => void;
  paletteSearch: string;
  setPaletteSearch: (search: string) => void;
  definition: FormDefinition;
  selectedId: string | null;
  addField: (type: FieldType) => void;
  selectFieldAndScroll: (fieldId: string) => void;
}

export const FieldPaletteSidebar: React.FC<FieldPaletteSidebarProps> = React.memo(({
  mobileStudioView,
  sidebarTab,
  setSidebarTab,
  paletteSearch,
  setPaletteSearch,
  definition,
  selectedId,
  addField,
  selectFieldAndScroll,
}) => {
  return (
    <div
      className={`sticky top-0 self-start max-h-[calc(100vh-8.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm ${
        mobileStudioView === 'palette' ? 'flex' : 'hidden lg:flex'
      }`}
    >
      <div className="p-3 border-b border-border bg-muted/20 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Components
          </h3>
          <div className="flex rounded-md bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSidebarTab('palette')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                sidebarTab === 'palette'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Library
            </button>
            <button
              type="button"
              onClick={() => setSidebarTab('outline')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                sidebarTab === 'outline'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Outline
            </button>
          </div>
        </div>
        {sidebarTab === 'palette' && (
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={paletteSearch}
              onChange={(e) => setPaletteSearch(e.target.value)}
              placeholder="Filter components..."
              className="h-7 pl-8 text-xs bg-background"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
        {sidebarTab === 'palette' ? (
          PALETTE.filter(
            (item) =>
              item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
              item.type.toLowerCase().includes(paletteSearch.toLowerCase()),
          ).map((item) => {
            const meta = PALETTE_META[item.type] || {
              label: item.label,
              icon: Type,
              description: '',
            };
            const Icon = meta.icon;
            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('field-type', item.type);
                }}
                className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-2 text-left text-sm transition-all hover:border-primary/50 hover:bg-muted/40 cursor-grab active:cursor-grabbing shadow-2xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-none truncate">{meta.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {meta.description}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0 opacity-40 group-hover:opacity-100"
                  title={`Add ${meta.label}`}
                  onClick={() => addField(item.type)}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        ) : (
          <div className="space-y-3 p-1">
            {definition.sections.map((sec, secIdx) => (
              <div key={sec.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="w-full text-left flex items-center justify-between text-xs font-semibold py-1 px-1.5 rounded hover:bg-muted/50"
                >
                  <span className="truncate">
                    §{secIdx + 1} {sec.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal bg-muted px-1.5 py-0.2 rounded">
                    {sec.fields.length}
                  </span>
                </button>
                <div className="pl-3 space-y-0.5 border-l border-border/60 ml-2">
                  {sec.fields.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => selectFieldAndScroll(f.id)}
                      className={`w-full text-left text-[11px] py-1 px-1.5 rounded truncate transition-colors ${
                        selectedId === f.id
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

FieldPaletteSidebar.displayName = 'FieldPaletteSidebar';
