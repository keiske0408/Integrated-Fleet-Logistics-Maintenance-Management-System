import { describe, expect, it } from 'vitest';
import type { LovAttribute } from '@/features/lov';
import {
  parseReferenceDataCsv,
  serializeReferenceDataCsv,
} from '@/features/maintenance/referenceDataCsv';

const attributes: LovAttribute[] = [
  {
    id: 'category',
    listCode: 'VEHICLE_TYPES',
    key: 'category',
    label: 'Category',
    type: 'select',
    required: true,
    showInGrid: true,
    sortOrder: 0,
    options: ['light', 'heavy'],
  },
  {
    id: 'interval',
    listCode: 'VEHICLE_TYPES',
    key: 'pms_interval_km',
    label: 'PMS Interval (km)',
    type: 'number',
    required: true,
    showInGrid: false,
    sortOrder: 1,
    options: [],
  },
];

describe('reference data CSV', () => {
  it('round-trips stable attribute keys and escapes quoted values', () => {
    const csv = serializeReferenceDataCsv(attributes, [
      {
        code: 'VAN',
        label: 'Van, "Fleet"',
        status: 'active',
        attrs: { category: 'light', pms_interval_km: 5000 },
      },
    ]);

    expect(csv.split('\r\n')[0]).toBe('code,label,category,pms_interval_km,status');
    expect(parseReferenceDataCsv(csv, attributes)).toEqual({
      rows: [
        {
          code: 'VAN',
          label: 'Van, "Fleet"',
          status: 'active',
          attrs: { category: 'light', pms_interval_km: 5000 },
        },
      ],
      errors: [],
    });
  });

  it('accepts the previous label-based export when its columns are unambiguous', () => {
    expect(
      parseReferenceDataCsv(
        'Code,Name,Category,PMS Interval (km),Active\r\nVAN,Commuter Van,light,5000,true',
        attributes,
      ).rows,
    ).toEqual([
      {
        code: 'VAN',
        label: 'Commuter Van',
        status: 'active',
        attrs: { category: 'light', pms_interval_km: 5000 },
      },
    ]);
  });

  it('rejects duplicate codes and invalid typed values without returning partial rows', () => {
    const result = parseReferenceDataCsv(
      'code,label,category,pms_interval_km,status\nVAN,Van,light,5000,active\nVAN,Van 2,heavy,5000,active\nVAN2,Van 3,heavy,not-a-number,active',
      attributes,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, message: 'Duplicate code "VAN" in CSV.' }),
        expect.objectContaining({
          row: 4,
          message: 'Attribute "pms_interval_km" must be a number.',
        }),
      ]),
    );
  });

  it('reports unknown columns and missing required attributes', () => {
    const result = parseReferenceDataCsv(
      'code,label,category,extra,status\nVAN,Van,invalid,ignored,active',
      attributes,
    );

    expect(result.rows).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 1, message: 'Unknown CSV column "extra".' }),
        expect.objectContaining({
          row: 1,
          message: 'CSV is missing required attribute "pms_interval_km".',
        }),
      ]),
    );
  });
});
