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