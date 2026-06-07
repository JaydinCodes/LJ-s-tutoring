import type { UserRole } from '../../types/lms';

export type SupportedDashboardRole = Extract<UserRole, 'student' | 'tutor' | 'admin' | 'parent' | 'ngo_partner'>;

export const DASHBOARD_ROLES: readonly SupportedDashboardRole[] = ['student', 'tutor', 'admin', 'parent', 'ngo_partner'];

const DASHBOARD_PATHS: Record<SupportedDashboardRole, string> = {
  admin: '/dashboard/admin',
  ngo_partner: '/dashboard/ngo/reports',
  parent: '/dashboard/parent/reports',
  tutor: '/dashboard/tutor',
  student: '/dashboard/student',
};

export function normalizeUserRole(value: unknown): SupportedDashboardRole | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return DASHBOARD_ROLES.includes(normalized as SupportedDashboardRole)
    ? normalized as SupportedDashboardRole
    : null;
}

export function getDashboardPath(role?: UserRole | null) {
  const normalized = normalizeUserRole(role);
  return normalized ? DASHBOARD_PATHS[normalized] : DASHBOARD_PATHS.student;
}

export function formatRoleList(roles: readonly SupportedDashboardRole[]) {
  return roles.map((role) => role.replace('_', ' ')).join(', ');
}
