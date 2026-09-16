import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertFacultyCanAssignStudent,
  canFacultyAdviseCohort,
} from "./section-access";

type AccessClient = NonNullable<
  Parameters<typeof canFacultyAdviseCohort>[3]
>;

function clientReturning(
  result: { id: string } | null,
  inspect?: (where: unknown) => void
): AccessClient {
  return {
    user: {
      findFirst: async (args: { where: unknown }) => {
        inspect?.(args.where);
        return result;
      },
    },
  } as unknown as AccessClient;
}

test("Faculty cohort authorization queries exact department, course, and section", async () => {
  let where: unknown;
  const allowed = await canFacultyAdviseCohort(
    "faculty-a",
    "BTVTEd - Animal Production",
    "BTVTED-2B",
    clientReturning({ id: "faculty-a" }, (value) => {
      where = value;
    })
  );
  assert.equal(allowed, true);
  assert.deepEqual(where, {
    id: "faculty-a",
    role: "FACULTY",
    department: "BTVTEd - Animal Production",
    advisories: {
      some: {
        course: "BTVTEd - Animal Production",
        section: "BTVTED-2B",
      },
    },
  });
});

test("same Section with a different Course is denied by the exact query", async () => {
  assert.equal(
    await canFacultyAdviseCohort(
      "faculty-a",
      "BS Agriculture - Crop Science",
      "3A",
      clientReturning(null)
    ),
    false
  );
});

test("course=NULL legacy advisory input is denied without querying", async () => {
  let queried = false;
  assert.equal(
    await canFacultyAdviseCohort(
      "faculty-a",
      null,
      "BSA-3D",
      clientReturning({ id: "faculty-a" }, () => {
        queried = true;
      })
    ),
    false
  );
  assert.equal(queried, false);
});

test("Admin and Super Admin retain broader assignment authorization", async () => {
  assert.equal(
    await assertFacultyCanAssignStudent("ADMIN", "admin", null, null),
    true
  );
  assert.equal(
    await assertFacultyCanAssignStudent("SUPER_ADMIN", "root", null, null),
    true
  );
});

test("Student Farmer assignment authorization remains denied", async () => {
  assert.equal(
    await assertFacultyCanAssignStudent(
      "STUDENT_FARMER",
      "student",
      "BTVTEd - Animal Production",
      "BTVTED-2B"
    ),
    false
  );
});
