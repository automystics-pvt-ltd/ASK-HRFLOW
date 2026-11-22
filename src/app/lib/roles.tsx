import { useAccess } from './access';
export { roleLabels, type Role } from './access';

/** Back-compat helper: flat capability flags derived from the permission matrix. */
export function useRole() {
  const { role, can: has, user } = useAccess();
  const can = {
    canAddEmployee: has('employees', 'create'),
    canEditEmployee: has('employees', 'update'),
    canExportData: has('employees', 'export'),
    canApproveLeave: has('attendance', 'approve'),
    canProcessPayroll: has('payroll', 'update'),
    canPostJobs: has('recruitment', 'create'),
    canManageCompany: has('settings', 'update'),
    canManageAccess: has('access', 'update'),
  };
  return { role, can, user };
}