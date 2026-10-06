import { describe, it, expect } from 'vitest';
import { evaluateTsrfSubmissionTime, DEFAULT_TSRF_CUTOFF } from '../src/domain/tsrf';
import { collectEditableFormChanges } from '../src/features/form-builder/FormRenderer';
import type { FormField, FormValues } from '../src/features/form-builder/types';

describe('Domain Rule 5: TSRF Cutoff Time Flagging', () => {
  it('should not flag TSRF request submitted before 16:00 (4:00 PM) standard cutoff', () => {
    // 2:30 PM (14:30)
    const submissionTime = new Date('2026-09-23T14:30:00');
    const result = evaluateTsrfSubmissionTime(submissionTime);

    expect(result.isFlaggedAfterCutoff).toBe(false);
    expect(result.cutoffTime).toBe('16:00');
    expect(DEFAULT_TSRF_CUTOFF.cutoffHour).toBe(16);
    expect(result.reason).toBeUndefined();
  });

  it('should flag TSRF request submitted at 16:01 (after 4:00 PM standard cutoff)', () => {
    // 4:01 PM (16:01)
    const submissionTime = new Date('2026-09-23T16:01:00');
    const result = evaluateTsrfSubmissionTime(submissionTime);

    expect(result.isFlaggedAfterCutoff).toBe(true);
    expect(result.cutoffTime).toBe('16:00');
    expect(result.reason).toContain('which is after daily cut-off time (16:00)');
    expect(result.reason).toContain('Flagged for supervisory exception review');
  });

  it('should flag TSRF request submitted late in the evening (e.g. 19:45)', () => {
    const submissionTime = new Date('2026-09-23T19:45:00');
    const result = evaluateTsrfSubmissionTime(submissionTime);

    expect(result.isFlaggedAfterCutoff).toBe(true);
  });

  it('should support department-specific cutoff overrides (e.g., early cutoff at 14:00)', () => {
    const customConfig = { cutoffHour: 14, cutoffMinute: 0 };

    // 14:15 is after custom 14:00 cutoff
    const submissionTime = new Date('2026-09-23T14:15:00');
    const result = evaluateTsrfSubmissionTime(submissionTime, customConfig);

    expect(result.isFlaggedAfterCutoff).toBe(true);
    expect(result.cutoffTime).toBe('14:00');
  });

  it('should include only changed editable fields, including nested repeater edits', () => {
    const fields: FormField[] = [
      { id: 'project', key: 'project', type: 'text', label: 'Project', section: 'request' },
      { id: 'notes', key: 'notes', type: 'text', label: 'Notes', section: 'request' },
      {
        id: 'passengers',
        key: 'passengers',
        type: 'repeater',
        label: 'Passengers',
        section: 'request',
        rowFields: [
          { id: 'name', key: 'name', type: 'text', label: 'Name', section: 'passenger' },
          { id: 'role', key: 'role', type: 'text', label: 'Role', section: 'passenger' },
        ],
      },
    ];
    const initial: FormValues = {
      project: 'Original',
      notes: 'Read-only',
      passengers: [{ name: 'Ana', role: 'Driver' }],
    };
    const updated: FormValues = {
      project: 'Revised',
      notes: 'Changed read-only value',
      passengers: [{ name: 'Ana Reyes', role: 'Changed read-only role' }],
    };

    expect(
      collectEditableFormChanges(fields, initial, updated, {
        project: 'edit',
        notes: 'read',
        passengers: 'read',
        'passengers.name': 'edit',
        'passengers.role': 'read',
      }),
    ).toEqual({
      project: 'Revised',
      passengers: [{ name: 'Ana Reyes' }],
    });
  });
});
