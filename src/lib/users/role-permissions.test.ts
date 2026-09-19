import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  assignableUserRoles,
  canAssignRole,
  canManageUser,
} from "./role-permissions";

function source(...segments: string[]): string {
  return readFileSync(join(process.cwd(), ...segments), "utf8");
}

test("ordinary Admin role options match the server assignment policy", () => {
  assert.deepEqual(assignableUserRoles("ADMIN"), [
    "FACULTY",
    "STUDENT_FARMER",
  ]);
  assert.equal(canAssignRole("ADMIN", "ADMIN"), false);
  assert.equal(canAssignRole("ADMIN", "SUPER_ADMIN"), false);
});

test("Super Admin retains every server-permitted role option", () => {
  assert.deepEqual(assignableUserRoles("SUPER_ADMIN"), [
    "SUPER_ADMIN",
    "ADMIN",
    "FACULTY",
    "STUDENT_FARMER",
  ]);
});

test("non-admin roles receive no user-creation role options", () => {
  assert.deepEqual(assignableUserRoles("FACULTY"), []);
  assert.deepEqual(assignableUserRoles("STUDENT_FARMER"), []);
});

test("ordinary Admin cannot manage an existing admin-tier account", () => {
  assert.equal(canManageUser("ADMIN", "ADMIN"), false);
  assert.equal(canManageUser("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canManageUser("ADMIN", "FACULTY"), true);
  assert.equal(canManageUser("ADMIN", "STUDENT_FARMER"), true);
});

test("Super Admin can manage every supported target role", () => {
  for (const role of [
    "SUPER_ADMIN",
    "ADMIN",
    "FACULTY",
    "STUDENT_FARMER",
  ] as const) {
    assert.equal(canManageUser("SUPER_ADMIN", role), true);
  }
});

test("Add and Edit pages pass server-derived options to the shared form", () => {
  const addPage = source(
    "src",
    "app",
    "dashboard",
    "users",
    "new",
    "page.tsx"
  );
  const editPage = source(
    "src",
    "app",
    "dashboard",
    "users",
    "[id]",
    "edit",
    "page.tsx"
  );
  const form = source("src", "components", "users", "user-form.tsx");
  const detailPage = source(
    "src",
    "app",
    "dashboard",
    "users",
    "[id]",
    "page.tsx"
  );
  const usersTable = source(
    "src",
    "components",
    "users",
    "users-table.tsx"
  );
  const detailActions = source(
    "src",
    "components",
    "users",
    "user-detail-actions-menu.tsx"
  );

  assert.match(
    addPage,
    /assignableUserRoles\(session\.user\.role\)[\s\S]*allowedRoles=\{allowedRoles\}/
  );
  assert.match(
    editPage,
    /canManageUser\(session\.user\.role, user\.role\)[\s\S]*:\s*\[user\.role\][\s\S]*if \(!canManageTarget\) redirect\(`\/dashboard\/users\/\$\{user\.id\}`\)[\s\S]*<UserForm[\s\S]*roleReadOnly=\{!canManageTarget\}/
  );
  assert.match(form, /allowedRoles\.map\(\(role\) =>/);
  assert.doesNotMatch(form, /<SelectItem value="(?:SUPER_ADMIN|ADMIN)">/);
  assert.match(
    detailPage,
    /\{canManageTarget && \([\s\S]*href=\{`\/dashboard\/users\/\$\{user\.id\}\/edit`\}/
  );
  assert.match(
    usersTable,
    /\{user\.canManage && \([\s\S]*href=\{`\/dashboard\/users\/\$\{user\.id\}\/edit`\}/
  );
  assert.match(detailActions, /if \(!canManage\) return null;/);
});
