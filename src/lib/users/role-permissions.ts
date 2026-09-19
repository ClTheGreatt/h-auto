import type { UserRole } from "@prisma/client";

const USER_ROLES: readonly UserRole[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "FACULTY",
  "STUDENT_FARMER",
];

const ADMIN_TIER: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];

// Can `actorRole` create/assign `targetRole` after the actor has passed the
// surrounding admin-only action check?
export function canAssignRole(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  return !ADMIN_TIER.includes(targetRole) || actorRole === "SUPER_ADMIN";
}

// Can `actorRole` manage (edit/deactivate) a user whose current role is
// `targetCurrentRole` after the actor has passed the admin-only action check?
export function canManageUser(
  actorRole: UserRole,
  targetCurrentRole: UserRole
): boolean {
  return !ADMIN_TIER.includes(targetCurrentRole) || actorRole === "SUPER_ADMIN";
}

// Complete role list for UI/API callers that need to mirror the effective
// create/update policy, including the surrounding admin-only access rule.
export function assignableUserRoles(actorRole: UserRole): UserRole[] {
  if (actorRole !== "ADMIN" && actorRole !== "SUPER_ADMIN") return [];
  return USER_ROLES.filter((targetRole) =>
    canAssignRole(actorRole, targetRole)
  );
}
