const departments = ['Executive', 'Engineering', 'Product', 'Design', 'Sales', 'Marketing', 'HR', 'Finance'];

export function toAppUser(row) {
  let departmentAccess = departments;
  if (row.department_access) {
    try {
      departmentAccess = typeof row.department_access === 'string' ? JSON.parse(row.department_access) : row.department_access;
    } catch {
      departmentAccess = [];
    }
  }
  let permissions;
  if (row.permissions) {
    try {
      permissions = typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions;
    } catch {
      permissions = undefined;
    }
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    department: row.department,
    active: !!row.active,
    departmentAccess,
    permissions,
    lastLogin: row.last_login ? new Date(row.last_login).toISOString() : undefined,
  };
}