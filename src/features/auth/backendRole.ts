export function toBackendRole(role: string | undefined): string {
  switch (role) {
    case 'system_admin':
      return 'admin';
    case 'fleet_manager':
    case 'logistics_manager':
      return 'fleet_team';
    case 'finance_manager':
      return 'finance';
    case 'procurement_officer':
      return 'procurement';
    default:
      return 'department_requester';
  }
}
