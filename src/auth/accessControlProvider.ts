import { AppAbility, Action, Subject } from './abilities';

export interface CanParams {
  resource?: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface CanReturnType {
  can: boolean;
  reason?: string;
}

export interface AccessControlProvider {
  can: (params: CanParams) => Promise<CanReturnType>;
}

// Maps Refine standard actions to CASL actions
export function mapRefineActionToCasl(refineAction: string): Action {
  switch (refineAction) {
    case 'list':
    case 'show':
      return 'read';
    case 'create':
    case 'clone':
      return 'create';
    case 'edit':
      return 'update';
    case 'delete':
      return 'delete';
    case 'approve':
      return 'approve';
    default:
      return 'read';
  }
}

// Maps Refine resource names to CASL Subjects
export function mapResourceToSubject(resource?: string): Subject {
  switch (resource?.toLowerCase()) {
    case 'vehicles':
      return 'Vehicle';
    case 'pms':
    case 'pms-records':
      return 'PMS';
    case 'repairs':
    case 'repair-work-orders':
      return 'RepairWorkOrder';
    case 'procurement':
    case 'purchase-requisitions':
      return 'PurchaseRequisition';
    case 'tsrf':
    case 'tsrf-requests':
      return 'TSRFRequest';
    default:
      return 'all';
  }
}

export function createRefineAccessControlProvider(ability: AppAbility): AccessControlProvider {
  return {
    can: async ({ resource, action }) => {
      const caslAction = mapRefineActionToCasl(action);
      const subject = mapResourceToSubject(resource);

      const hasPermission = ability.can(caslAction, subject);

      return {
        can: hasPermission,
        reason: hasPermission
          ? undefined
          : `Unauthorized: User role does not have permission to ${caslAction} on ${subject}.`,
      };
    },
  };
}
