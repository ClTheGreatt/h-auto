import type { UserRole, UserStatus } from "@prisma/client";

export const UNCATEGORIZED = "Uncategorized";

export type StudentUserRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  idNumber: string | null;
  course: string | null;
  yearLevel: string | null;
  section: string | null;
};

// Only the fields needed to compute filter dropdown options and baseline
// (unfiltered) counts, fetched separately so the "X of Y" counts don't
// shift as search/status/course/year/section filters narrow the main query.
export type StudentFieldRow = Pick<StudentUserRow, "course" | "yearLevel" | "section">;

export type SectionGroup = {
  key: string;
  label: string;
  users: StudentUserRow[];
  count: number;
  totalCount: number;
};

export type YearGroup = {
  key: string;
  label: string;
  sections: SectionGroup[];
  count: number;
  totalCount: number;
};

export type CourseGroup = {
  key: string;
  label: string;
  isUncategorized: boolean;
  years: YearGroup[];
  // Only populated when isUncategorized: flat list, no year/section nesting.
  flatUsers: StudentUserRow[];
  count: number;
  totalCount: number;
};

const KEY_SEP = "::";

function withUncategorizedLast(cmp: (a: string, b: string) => number) {
  return (a: string, b: string) => {
    if (a === UNCATEGORIZED && b === UNCATEGORIZED) return 0;
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return cmp(a, b);
  };
}

function alphaComparator(a: string, b: string): number {
  return a.localeCompare(b);
}

function yearBaseComparator(a: string, b: string): number {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  const aNum = !Number.isNaN(na);
  const bNum = !Number.isNaN(nb);
  if (aNum && bNum && na !== nb) return na - nb;
  if (aNum !== bNum) return aNum ? -1 : 1;
  return a.localeCompare(b);
}

export const courseComparator = withUncategorizedLast(alphaComparator);
export const yearComparator = withUncategorizedLast(yearBaseComparator);
export const sectionComparator = withUncategorizedLast(alphaComparator);

function byLastName(a: StudentUserRow, b: StudentUserRow): number {
  return (
    a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );
}

function courseKeyOf(row: { course: string | null }): string {
  return row.course?.trim() || UNCATEGORIZED;
}
function yearKeyOf(row: { yearLevel: string | null }): string {
  return row.yearLevel?.trim() || UNCATEGORIZED;
}
function sectionKeyOf(row: { section: string | null }): string {
  return row.section?.trim() || UNCATEGORIZED;
}

// Distinct, sorted values for filter dropdown options.
export function uniqueCourses(rows: StudentFieldRow[]): string[] {
  const set = new Set(rows.map((r) => r.course?.trim()).filter((v): v is string => !!v));
  return [...set].sort(alphaComparator);
}
export function uniqueYearLevels(rows: StudentFieldRow[]): string[] {
  const set = new Set(rows.map((r) => r.yearLevel?.trim()).filter((v): v is string => !!v));
  return [...set].sort(yearBaseComparator);
}
export function uniqueSections(rows: StudentFieldRow[]): string[] {
  const set = new Set(rows.map((r) => r.section?.trim()).filter((v): v is string => !!v));
  return [...set].sort(alphaComparator);
}

/**
 * Groups the (already filtered) student rows into Course > Year > Section,
 * with `totalCount` on each group looked up from `baseline` (the full,
 * unfiltered student roster) so headers can render "X of Y" while filtered.
 * Students missing a course fall into a flat "Uncategorized" course group
 * (Task 6a); students with a course but missing year/section nest under an
 * "Uncategorized" year/section label instead, so partial data still drills
 * down as far as it can.
 */
export function groupStudents(
  filtered: StudentUserRow[],
  baseline: StudentFieldRow[]
): CourseGroup[] {
  const baselineCourseCount = new Map<string, number>();
  const baselineYearCount = new Map<string, number>();
  const baselineSectionCount = new Map<string, number>();

  for (const row of baseline) {
    const c = courseKeyOf(row);
    baselineCourseCount.set(c, (baselineCourseCount.get(c) ?? 0) + 1);
    if (c === UNCATEGORIZED) continue;
    const y = yearKeyOf(row);
    const yKey = [c, y].join(KEY_SEP);
    baselineYearCount.set(yKey, (baselineYearCount.get(yKey) ?? 0) + 1);
    const s = sectionKeyOf(row);
    const sKey = [yKey, s].join(KEY_SEP);
    baselineSectionCount.set(sKey, (baselineSectionCount.get(sKey) ?? 0) + 1);
  }

  type CourseEntry = {
    flatUsers: StudentUserRow[];
    years: Map<string, Map<string, StudentUserRow[]>>;
  };
  const courseMap = new Map<string, CourseEntry>();

  for (const row of filtered) {
    const c = courseKeyOf(row);
    let courseEntry = courseMap.get(c);
    if (!courseEntry) {
      courseEntry = { flatUsers: [], years: new Map() };
      courseMap.set(c, courseEntry);
    }
    if (c === UNCATEGORIZED) {
      courseEntry.flatUsers.push(row);
      continue;
    }
    const y = yearKeyOf(row);
    let sections = courseEntry.years.get(y);
    if (!sections) {
      sections = new Map();
      courseEntry.years.set(y, sections);
    }
    const s = sectionKeyOf(row);
    const users = sections.get(s) ?? [];
    users.push(row);
    sections.set(s, users);
  }

  const courseKeys = [...courseMap.keys()].sort(courseComparator);

  return courseKeys.map((c): CourseGroup => {
    const entry = courseMap.get(c)!;

    if (c === UNCATEGORIZED) {
      const users = [...entry.flatUsers].sort(byLastName);
      return {
        key: c,
        label: c,
        isUncategorized: true,
        years: [],
        flatUsers: users,
        count: users.length,
        totalCount: baselineCourseCount.get(c) ?? users.length,
      };
    }

    const yearKeys = [...entry.years.keys()].sort(yearComparator);
    const years: YearGroup[] = yearKeys.map((y) => {
      const sectionsMap = entry.years.get(y)!;
      const sectionKeys = [...sectionsMap.keys()].sort(sectionComparator);
      const yKey = [c, y].join(KEY_SEP);
      const sections: SectionGroup[] = sectionKeys.map((s) => {
        const users = [...sectionsMap.get(s)!].sort(byLastName);
        const sKey = [yKey, s].join(KEY_SEP);
        return {
          key: s,
          label: s,
          users,
          count: users.length,
          totalCount: baselineSectionCount.get(sKey) ?? users.length,
        };
      });
      const count = sections.reduce((sum, s) => sum + s.count, 0);
      return {
        key: y,
        label: y,
        sections,
        count,
        totalCount: baselineYearCount.get(yKey) ?? count,
      };
    });
    const count = years.reduce((sum, y) => sum + y.count, 0);

    return {
      key: c,
      label: c,
      isUncategorized: false,
      years,
      flatUsers: [],
      count,
      totalCount: baselineCourseCount.get(c) ?? count,
    };
  });
}
