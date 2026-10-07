import type { LovAttribute, LovItem, LovItemStatus } from '@/features/lov';

export interface ReferenceDataCsvRow {
  code: string;
  label: string;
  status: LovItemStatus;
  attrs: Record<string, string | number | boolean>;
}

export interface ReferenceDataCsvError {
  row: number;
  message: string;
}

export interface ReferenceDataCsvResult {
  rows: ReferenceDataCsvRow[];
  errors: ReferenceDataCsvError[];
}

function parseRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      record.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      record.push(field);
      if (record.some((value) => value !== '')) records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    if (record.some((value) => value !== '')) records.push(record);
  }
  return records;
}

function encodeCsvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeReferenceDataCsv(
  attributes: LovAttribute[],
  items: Array<Pick<LovItem, 'code' | 'label' | 'status' | 'attrs'>>,
): string {
  const headers = ['code', 'label', ...attributes.map((attribute) => attribute.key), 'status'];
  const rows = items.map((item) => [
    item.code,
    item.label,
    ...attributes.map((attribute) => item.attrs[attribute.key] ?? ''),
    item.status,
  ]);
  return [headers, ...rows].map((row) => row.map(encodeCsvCell).join(',')).join('\r\n');
}

function parseAttributeValue(value: string, attribute: LovAttribute): string | number | boolean {
  if (attribute.type === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`Attribute "${attribute.key}" must be a number.`);
    return parsed;
  }
  if (attribute.type === 'boolean') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    throw new Error(`Attribute "${attribute.key}" must be true or false.`);
  }
  if (attribute.type === 'select' && !attribute.options.includes(value)) {
    throw new Error(`Attribute "${attribute.key}" has an invalid option.`);
  }
  return value;
}

export function parseReferenceDataCsv(
  csv: string,
  attributes: LovAttribute[],
): ReferenceDataCsvResult {
  let records: string[][];
  try {
    records = parseRecords(csv.replace(/^\uFEFF/, ''));
  } catch (error) {
    return {
      rows: [],
      errors: [{ row: 1, message: error instanceof Error ? error.message : 'Invalid CSV.' }],
    };
  }

  const [header, ...data] = records;
  if (!header) return { rows: [], errors: [{ row: 1, message: 'CSV is empty.' }] };

  const normalizedHeader = header.map((column) => column.trim().toLowerCase());
  const canonical = normalizedHeader[0] === 'code' && normalizedHeader[1] === 'label';
  const legacy = normalizedHeader[0] === 'code' && normalizedHeader[1] === 'name';
  if (!canonical && !legacy) {
    return {
      rows: [],
      errors: [{ row: 1, message: 'CSV must start with Code and Label columns.' }],
    };
  }

  const errors: ReferenceDataCsvError[] = [];
  const duplicateHeaders = normalizedHeader.filter(
    (column, index) => normalizedHeader.indexOf(column) !== index,
  );
  if (duplicateHeaders.length > 0) {
    return { rows: [], errors: [{ row: 1, message: 'CSV contains duplicate column headers.' }] };
  }

  const statusColumn = normalizedHeader.indexOf(canonical ? 'status' : 'active');
  if (statusColumn < 0) {
    return { rows: [], errors: [{ row: 1, message: 'CSV is missing the status column.' }] };
  }

  const columnsByAttribute = new Map<number, LovAttribute>();
  for (const attribute of attributes) {
    const matchingColumns = normalizedHeader
      .map((column, index) => ({ column, index }))
      .filter(({ column }) =>
        canonical
          ? column === attribute.key.toLowerCase()
          : column === attribute.label.trim().toLowerCase(),
      );
    if (matchingColumns.length > 1) {
      errors.push({ row: 1, message: `Attribute "${attribute.key}" has an ambiguous CSV column.` });
    } else if (matchingColumns.length === 1) {
      columnsByAttribute.set(matchingColumns[0].index, attribute);
    }
  }

  const legacyLabelCounts = new Map<string, number>();
  if (legacy) {
    attributes.forEach((attribute) => {
      const key = attribute.label.trim().toLowerCase();
      legacyLabelCounts.set(key, (legacyLabelCounts.get(key) ?? 0) + 1);
    });
    for (const [columnIndex] of columnsByAttribute) {
      if ((legacyLabelCounts.get(normalizedHeader[columnIndex]) ?? 0) > 1) {
        errors.push({ row: 1, message: `Legacy column "${header[columnIndex]}" is ambiguous.` });
      }
    }
  }
  const recognizedColumns = new Set([0, 1, statusColumn, ...columnsByAttribute.keys()]);
  normalizedHeader.forEach((column, index) => {
    if (!recognizedColumns.has(index)) {
      errors.push({ row: 1, message: `Unknown CSV column "${header[index]}".` });
    }
  });
  attributes.forEach((attribute) => {
    if (
      attribute.required &&
      !Array.from(columnsByAttribute.values()).some((mapped) => mapped.key === attribute.key)
    ) {
      errors.push({ row: 1, message: `CSV is missing required attribute "${attribute.key}".` });
    }
  });
  if (errors.length > 0) return { rows: [], errors };

  const rows: ReferenceDataCsvRow[] = [];
  const seenCodes = new Set<string>();
  data.forEach((cells, index) => {
    const rowNumber = index + 2;
    if (cells.length !== header.length) {
      errors.push({ row: rowNumber, message: 'Column count does not match the header.' });
      return;
    }
    const code = cells[0].trim();
    const label = cells[1].trim();
    if (!code || !label) {
      errors.push({ row: rowNumber, message: 'Code and label are required.' });
      return;
    }
    if (seenCodes.has(code)) {
      errors.push({ row: rowNumber, message: `Duplicate code "${code}" in CSV.` });
      return;
    }
    seenCodes.add(code);

    const rawStatus = cells[statusColumn].trim().toLowerCase();
    const status = canonical
      ? rawStatus === 'active' || rawStatus === 'inactive'
        ? rawStatus
        : null
      : rawStatus === 'true'
        ? 'active'
        : rawStatus === 'false'
          ? 'inactive'
          : null;
    if (!status) {
      errors.push({ row: rowNumber, message: `Invalid status "${cells[statusColumn]}".` });
      return;
    }

    const attrs: ReferenceDataCsvRow['attrs'] = {};
    let rowHasError = false;
    for (const [columnIndex, attribute] of columnsByAttribute) {
      const value = cells[columnIndex].trim();
      if (value === '') {
        if (attribute.required) {
          errors.push({ row: rowNumber, message: `Attribute "${attribute.key}" is required.` });
          rowHasError = true;
        }
        continue;
      }
      try {
        attrs[attribute.key] = parseAttributeValue(value, attribute);
      } catch (error) {
        errors.push({
          row: rowNumber,
          message: error instanceof Error ? error.message : `Invalid value for "${attribute.key}".`,
        });
        rowHasError = true;
      }
    }
    if (!rowHasError) rows.push({ code, label, status, attrs });
  });

  return { rows: errors.length === 0 ? rows : [], errors };
}
