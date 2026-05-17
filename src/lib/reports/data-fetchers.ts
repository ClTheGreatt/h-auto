import { prisma } from "@/lib/prisma";
import { getDateFromRange, type TimeRange } from "@/lib/analytics/time-range";

export type ReportFilters = {
  range: TimeRange;
  plotId?: string;
};

export async function fetchSensorReadingsData(filters: ReportFilters) {
  const since = getDateFromRange(filters.range);

  const readings = await prisma.sensorReading.findMany({
    where: {
      ...(since ? { recordedAt: { gte: since } } : {}),
      ...(filters.plotId ? { plotId: filters.plotId } : {}),
    },
    orderBy: { recordedAt: "desc" },
    take: 5000,
    include: {
      plot: { select: { name: true, location: true } },
      device: { select: { deviceCode: true } },
    },
  });

  return readings.map((r) => ({
    recordedAt: r.recordedAt,
    plotName: r.plot.name,
    plotLocation: r.plot.location ?? "-",
    deviceCode: r.device.deviceCode,
    soilMoisture: r.soilMoisture,
    temperature: r.temperature,
    humidity: r.humidity,
    lightIntensity: r.lightIntensity,
    nitrogen: r.nitrogen,
    phosphorus: r.phosphorus,
    potassium: r.potassium,
  }));
}

export async function fetchPlotPerformanceData(filters: ReportFilters) {
  const since = getDateFromRange(filters.range);

  const plots = await prisma.plot.findMany({
    orderBy: { name: "asc" },
    include: {
      crop: { select: { name: true, variety: true } },
      currentStage: { select: { name: true } },
      _count: {
        select: {
          sensorReadings: {
            where: since ? { recordedAt: { gte: since } } : {},
          },
          growthLogs: {
            where: since ? { createdAt: { gte: since } } : {},
          },
          alerts: {
            where: since ? { createdAt: { gte: since } } : {},
          },
          assignments: { where: { status: "ACTIVE" } },
        },
      },
    },
  });

  const result = [];
  for (const plot of plots) {
    const openAlertCount = await prisma.alert.count({
      where: { plotId: plot.id, resolved: false },
    });

    const latestLog = await prisma.growthLog.findFirst({
      where: { plotId: plot.id },
      orderBy: { createdAt: "desc" },
      select: { plantHeightCm: true, leafCount: true, createdAt: true },
    });

    result.push({
      plotName: plot.name,
      location: plot.location ?? "-",
      crop: plot.crop?.name ?? "None",
      variety: plot.crop?.variety ?? "-",
      stage: plot.currentStage?.name ?? "-",
      status: plot.status,
      plantingDate: plot.plantingDate,
      expectedHarvest: plot.expectedHarvest,
      readingCount: plot._count.sensorReadings,
      logCount: plot._count.growthLogs,
      alertCount: plot._count.alerts,
      openAlertCount,
      activeAssignments: plot._count.assignments,
      latestHeight: latestLog?.plantHeightCm ?? null,
      latestLeafCount: latestLog?.leafCount ?? null,
    });
  }

  return result;
}

export async function fetchGrowthLogData(filters: ReportFilters) {
  const since = getDateFromRange(filters.range);

  const logs = await prisma.growthLog.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(filters.plotId ? { plotId: filters.plotId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      plot: { select: { name: true } },
      stage: { select: { name: true } },
      user: { select: { firstName: true, lastName: true } },
      images: { select: { imageUrl: true } },
    },
  });

  return logs.map((log) => ({
    createdAt: log.createdAt,
    plotName: log.plot.name,
    stageName: log.stage?.name ?? "-",
    authorName: `${log.user.firstName} ${log.user.lastName}`,
    plantHeightCm: log.plantHeightCm,
    leafCount: log.leafCount,
    observations: log.observations ?? "",
    notes: log.notes ?? "",
    imageCount: log.images.length,
  }));
}

export async function fetchAlertsData(filters: ReportFilters) {
  const since = getDateFromRange(filters.range);

  const alerts = await prisma.alert.findMany({
    where: {
      ...(since ? { createdAt: { gte: since } } : {}),
      ...(filters.plotId ? { plotId: filters.plotId } : {}),
    },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    include: {
      plot: { select: { name: true } },
      notifications: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  return alerts.map((a) => ({
    createdAt: a.createdAt,
    plotName: a.plot.name,
    type: a.type,
    severity: a.severity,
    message: a.message,
    resolved: a.resolved,
    resolvedAt: a.resolvedAt,
    notificationsSent: a.notifications.filter((n) => n.status === "SENT").length,
    notificationsFailed: a.notifications.filter((n) => n.status === "FAILED").length,
    recipients: a.notifications
      .map((n) => `${n.user.firstName} ${n.user.lastName}`)
      .join(", "),
  }));
}

export async function fetchActivityData(filters: ReportFilters) {
  const since = getDateFromRange(filters.range);
  const dateFilter = since ? { gte: since } : undefined;

  type ActivityEvent = {
    timestamp: Date;
    eventType: string;
    description: string;
    actor: string;
  };

  const events: ActivityEvent[] = [];

  // Fetch each entity type with safe try/catch so one bad source doesn't kill the report
  try {
    const users = await prisma.user.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        createdAt: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });
    for (const u of users) {
      events.push({
        timestamp: u.createdAt,
        eventType: "User Created",
        description: `${u.firstName} ${u.lastName} (${u.email}) - ${u.role}`,
        actor: "System",
      });
    }
  } catch (e) {
    console.warn("Activity: failed to fetch users", e);
  }

  try {
    const plots = await prisma.plot.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { createdAt: true, name: true, location: true, status: true },
    });
    for (const p of plots) {
      events.push({
        timestamp: p.createdAt,
        eventType: "Plot Created",
        description: `${p.name}${p.location ? ` at ${p.location}` : ""} - ${p.status}`,
        actor: "System",
      });
    }
  } catch (e) {
    console.warn("Activity: failed to fetch plots", e);
  }

  try {
    const devices = await prisma.device.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { plot: { select: { name: true } } },
    });
    for (const d of devices) {
      events.push({
        timestamp: d.createdAt,
        eventType: "Device Registered",
        description: `${d.deviceCode} linked to ${d.plot.name}`,
        actor: "System",
      });
    }
  } catch (e) {
    console.warn("Activity: failed to fetch devices", e);
  }

  try {
    const assignments = await prisma.plotAssignment.findMany({
      where: dateFilter ? { assignedAt: dateFilter } : {},
      orderBy: { assignedAt: "desc" },
      take: 100,
      include: {
        plot: { select: { name: true } },
        student: { select: { firstName: true, lastName: true } },
        faculty: { select: { firstName: true, lastName: true } },
      },
    });
    for (const a of assignments) {
      events.push({
        timestamp: a.assignedAt,
        eventType: "Assignment",
        description: `${a.student.firstName} ${a.student.lastName} assigned to ${a.plot.name}`,
        actor: `${a.faculty.firstName} ${a.faculty.lastName}`,
      });
    }
  } catch (e) {
    console.warn("Activity: failed to fetch assignments", e);
  }

  // Imports - try multiple possible field names for backwards compatibility
  try {
    const imports = await prisma.importBatch.findMany({
      where: dateFilter ? { createdAt: dateFilter } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    for (const imp of imports) {
      events.push({
        timestamp: imp.createdAt,
        eventType: "Import",
        description: `Imported ${imp.successCount} ${imp.entityType.toLowerCase()} records (${imp.failureCount} failed)`,
        actor: "System",
      });
    }
  } catch (e) {
    console.warn("Activity: failed to fetch imports", e);
  }

  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}