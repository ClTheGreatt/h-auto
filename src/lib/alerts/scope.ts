import "server-only";

import type { PlotStatus, Prisma, UserRole } from "@prisma/client";

export type AlertScopeActor = {
  role: UserRole;
  userId: string;
};

export const OPERATIONAL_PLOT_STATUSES: PlotStatus[] = [
  "PLANTED",
  "GROWING",
  "READY_FOR_HARVEST",
];

function buildRolePlotWhere({
  role,
  userId,
}: AlertScopeActor): Prisma.PlotWhereInput {
  if (role === "FACULTY") {
    return { facultyId: userId };
  }

  if (role === "STUDENT_FARMER") {
    return {
      assignments: {
        some: {
          studentId: userId,
          status: "ACTIVE",
          endedAt: null,
          student: {
            is: {
              status: "ACTIVE",
              graduatedAt: null,
            },
          },
        },
      },
    };
  }

  return {};
}

export function buildAccessiblePlotWhere(
  actor: AlertScopeActor,
  additionalWhere: Prisma.PlotWhereInput = {}
): Prisma.PlotWhereInput {
  return {
    AND: [buildRolePlotWhere(actor), additionalWhere],
  };
}

export function buildOperationalAlertWhere(
  actor: AlertScopeActor,
  additionalWhere: Prisma.AlertWhereInput = {}
): Prisma.AlertWhereInput {
  return {
    AND: [
      { resolved: false },
      {
        plot: buildAccessiblePlotWhere(actor, {
          status: { in: OPERATIONAL_PLOT_STATUSES },
        }),
      },
      additionalWhere,
    ],
  };
}

export function buildHistoricalAlertWhere(
  actor: AlertScopeActor,
  {
    includeArchivedForAdmins = false,
    additionalWhere = {},
  }: {
    includeArchivedForAdmins?: boolean;
    additionalWhere?: Prisma.AlertWhereInput;
  } = {}
): Prisma.AlertWhereInput {
  const isAdmin = actor.role === "SUPER_ADMIN" || actor.role === "ADMIN";
  const lifecycleWhere: Prisma.PlotWhereInput =
    includeArchivedForAdmins && isAdmin
      ? {}
      : { status: { not: "ARCHIVED" } };

  return {
    AND: [
      { resolved: true },
      {
        plot: buildAccessiblePlotWhere(actor, lifecycleWhere),
      },
      additionalWhere,
    ],
  };
}
