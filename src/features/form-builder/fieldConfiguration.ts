export interface FormOption {
  value: string;
  label: string;
}

export function parseFieldOptions(source: string): FormOption[] {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      if (separator < 0) return { value: line, label: line };
      const value = line.slice(0, separator).trim();
      const label = line.slice(separator + 1).trim();
      return { value, label: label || value };
    })
    .filter((option) => option.value.length > 0);
}

export function formatFieldOptions(options: FormOption[] = []): string {
  return options.map((option) => `${option.value}:${option.label}`).join('\n');
}
