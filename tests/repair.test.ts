import { describe, it, expect } from 'vitest';
import { validateRepairApproval } from '../src/domain/repair';

describe('Domain Rules 2 & 3: Repair Work Order PMS Compliance & Incident Reporting', () => {
  it('should reject repair work order approval if PMS compliance check fails', () => {
    const result = validateRepairApproval({
      isPmsCompliant: false,
      wasPmsSkipped: false,
      incidentReportFiled: false,
    });

    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain('failed PMS compliance check');
  });

  it('should reject repair work order approval if PMS was skipped and incident report is missing', () => {
    const result = validateRepairApproval({
      isPmsCompliant: true,
      wasPmsSkipped: true,
      incidentReportFiled: false,
    });

    expect(result.canApprove).toBe(false);
    expect(result.reason).toContain(
      'PMS was skipped and mandatory incident/damage report has not been filed',
    );
  });

  it('should approve repair work order when PMS was skipped but mandatory incident report is filed', () => {
    const result = validateRepairApproval({
      isPmsCompliant: true,
      wasPmsSkipped: true,
      incidentReportFiled: true,
    });

    expect(result.canApprove).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should approve repair work order when vehicle is fully PMS compliant and was not skipped', () => {
    const result = validateRepairApproval({
      isPmsCompliant: true,
      wasPmsSkipped: false,
      incidentReportFiled: false,
    });

    expect(result.canApprove).toBe(true);
  });
});
