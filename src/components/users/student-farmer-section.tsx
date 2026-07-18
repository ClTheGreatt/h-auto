"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Table, TableBody, TableHeader, TableRow, TableCell } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  UserTableColgroup,
  UserTableHeaderRow,
  UserTableRow,
  STUDENT_FARMER_META,
} from "./users-table";
import { abbreviateCourse } from "@/lib/utils/course";
import { cn } from "@/lib/utils";
import type { CourseGroup, YearGroup } from "@/lib/users/group-students";

const SECTION_KEY_SEP = "::";

function countLabel(count: number, totalCount: number, hasFilters: boolean): string {
  if (hasFilters && totalCount !== count) {
    return `${count} of ${totalCount}`;
  }
  return `${count}`;
}

function allSectionKeys(courseGroups: CourseGroup[]): string[] {
  const keys: string[] = [];
  for (const course of courseGroups) {
    for (const year of course.years) {
      for (const section of year.sections) {
        keys.push([course.key, year.key, section.key].join(SECTION_KEY_SEP));
      }
    }
  }
  return keys;
}

export function StudentFarmerSection({
  courseGroups,
  hasFilters,
}: {
  courseGroups: CourseGroup[];
  hasFilters: boolean;
}) {
  const totalCount = courseGroups.reduce((sum, c) => sum + c.count, 0);
  const totalBaseline = courseGroups.reduce((sum, c) => sum + c.totalCount, 0);

  // Sections start collapsed on every page load (no persistence). When a
  // search/filter is active, start with matching sections expanded so
  // filtered-in students aren't hidden behind a collapsed section.
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    hasFilters ? new Set(allSectionKeys(courseGroups)) : new Set()
  );

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <section className="overflow-hidden rounded-md border bg-white shadow-sm dark:bg-gray-900">
      {/* Section header, matches RoleSection styling */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className={cn("text-sm font-semibold", STUDENT_FARMER_META.badgeColor)}>
              {STUDENT_FARMER_META.label}
            </h2>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {countLabel(totalCount, totalBaseline, hasFilters)}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {STUDENT_FARMER_META.description}
          </p>
        </div>
      </div>

      {courseGroups.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">
          No student farmers match the current filters. Try adjusting your
          search or filters.
        </div>
      ) : (
        // A single continuous table for the whole section: one header, and
        // course/year/section labels rendered as full-width rows within the
        // same table body, so every data row lines up under the one header.
        <TooltipProvider delayDuration={200}>
          <div>
            <Table className="min-w-[760px] table-fixed">
              <UserTableColgroup />
              <TableHeader>
                <UserTableHeaderRow />
              </TableHeader>
              <TableBody>
                {courseGroups.map((course) => (
                  <CourseRows
                    key={course.key}
                    course={course}
                    hasFilters={hasFilters}
                    expanded={expanded}
                    onToggleSection={toggle}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </TooltipProvider>
      )}
    </section>
  );
}

function CourseRows({
  course,
  hasFilters,
  expanded,
  onToggleSection,
}: {
  course: CourseGroup;
  hasFilters: boolean;
  expanded: Set<string>;
  onToggleSection: (key: string) => void;
}) {
  const abbreviated = useMemo(() => abbreviateCourse(course.label), [course.label]);
  const showTooltip = abbreviated !== course.label;

  return (
    <>
      <TableRow className="bg-muted/30 hover:bg-muted/30">
        <TableCell colSpan={5} className="px-4 py-2">
          <div className="flex items-center gap-2">
            {showTooltip ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <h3 className="text-base font-semibold">{abbreviated}</h3>
                </TooltipTrigger>
                <TooltipContent>{course.label}</TooltipContent>
              </Tooltip>
            ) : (
              <h3 className="text-base font-semibold">{abbreviated}</h3>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {countLabel(course.count, course.totalCount, hasFilters)}
            </span>
          </div>
        </TableCell>
      </TableRow>

      {course.isUncategorized ? (
        <>
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={5} className="px-4 pt-0 pb-1 text-xs text-gray-500">
              These users are missing course, year, or section information.
            </TableCell>
          </TableRow>
          {course.flatUsers.map((user) => (
            <UserTableRow key={user.id} user={user} />
          ))}
        </>
      ) : (
        course.years.map((year) => (
          <YearRows
            key={year.key}
            courseKey={course.key}
            year={year}
            hasFilters={hasFilters}
            expanded={expanded}
            onToggleSection={onToggleSection}
          />
        ))
      )}
    </>
  );
}

function YearRows({
  courseKey,
  year,
  hasFilters,
  expanded,
  onToggleSection,
}: {
  courseKey: string;
  year: YearGroup;
  hasFilters: boolean;
  expanded: Set<string>;
  onToggleSection: (key: string) => void;
}) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={5} className="px-4 py-1.5 pl-8">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {year.label}
            </h4>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
              {countLabel(year.count, year.totalCount, hasFilters)}
            </span>
          </div>
        </TableCell>
      </TableRow>

      {year.sections.map((section) => {
        const key = [courseKey, year.key, section.key].join(SECTION_KEY_SEP);
        const isOpen = expanded.has(key);
        return (
          <Fragment key={key}>
            <TableRow
              onClick={() => onToggleSection(key)}
              className="cursor-pointer hover:bg-muted/50"
            >
              <TableCell colSpan={5} className="px-4 py-1.5 pl-12 text-sm">
                <div className="flex items-center gap-2">
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                  <span>
                    {section.label} (
                    {countLabel(section.count, section.totalCount, hasFilters)} student
                    {section.count === 1 ? "" : "s"})
                  </span>
                </div>
              </TableCell>
            </TableRow>
            {isOpen &&
              section.users.map((user) => <UserTableRow key={user.id} user={user} />)}
          </Fragment>
        );
      })}
    </>
  );
}
