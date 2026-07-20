import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { UserRole } from "@prisma/client";

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireRole(allowed: UserRole[]) {
  const session = await requireAuth();
  if (!allowed.includes(session.user.role)) redirect("/dashboard");
  return session;
}

export async function requireAdmin() {
  return requireRole(["SUPER_ADMIN", "ADMIN"]);
}

export async function requireFaculty() {
  return requireRole(["SUPER_ADMIN", "ADMIN", "FACULTY"]);
}

const ADMIN_TIER: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

// Can `actorRole` create/assign `targetRole`?
// Assigning an admin-tier role requires the actor to be SUPER_ADMIN.
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  return !ADMIN_TIER.includes(targetRole) || actorRole === "SUPER_ADMIN";
}

// Can `actorRole` manage (edit/deactivate) a user whose current role is `targetCurrentRole`?
// Managing an admin-tier account requires the actor to be SUPER_ADMIN.
export function canManageUser(actorRole: UserRole, targetCurrentRole: UserRole): boolean {
  return !ADMIN_TIER.includes(targetCurrentRole) || actorRole === "SUPER_ADMIN";
}