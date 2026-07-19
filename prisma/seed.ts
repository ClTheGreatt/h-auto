import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

// 16 chars, alphanumeric-only (base64 minus the +/= padding characters that
// would otherwise make the password awkward to select/copy from a terminal).
function generateStrongPassword(): string {
  return randomBytes(12).toString("base64").replace(/[+/=]/g, "").slice(0, 16);
}

// =================================================================
// ADMIN USER
// =================================================================
async function seedAdmin() {
  const email = "admin@h-auto.local";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`✓ Admin already exists (${email}) — password unchanged`);
    return;
  }

  const password = generateStrongPassword();
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "System",
      lastName: "Administrator",
      role: UserRole.SUPER_ADMIN,
    },
  });
  console.log(`✓ Admin created: ${email} / ${password}`);
  console.log("  ⚠️  SAVE THIS PASSWORD NOW — it will NOT be shown again");
}

// =================================================================
// FACULTY + STUDENT TEST USERS
// =================================================================
type TestUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: UserRole;
  department?: string;
  course?: string;
};

async function seedTestUsers() {
  const testUsers: TestUserInput[] = [
    {
      email: "maria@h-auto.local",
      firstName: "Maria",
      lastName: "Reyes",
      phoneNumber: "09171234567",
      role: UserRole.FACULTY,
      department: "Agriculture",
    },
    {
      email: "pedro@h-auto.local",
      firstName: "Pedro",
      lastName: "Santos",
      phoneNumber: "09181234567",
      role: UserRole.STUDENT_FARMER,
      course: "BSIT",
    },
    {
      email: "juan@h-auto.local",
      firstName: "Juan",
      lastName: "Cruz",
      phoneNumber: "09191234567",
      role: UserRole.STUDENT_FARMER,
      course: "BSIT",
    },
  ];

  for (const testUser of testUsers) {
    const existing = await prisma.user.findUnique({ where: { email: testUser.email } });
    if (existing) {
      console.log(`✓ ${testUser.email} already exists — password unchanged`);
      continue;
    }

    const password = generateStrongPassword();
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: { ...testUser, passwordHash },
    });
    console.log(`✓ ${testUser.role} created: ${testUser.email} / ${password}`);
    console.log("  ⚠️  SAVE THIS PASSWORD NOW — it will NOT be shown again");
  }
}

// =================================================================
// CROPS WITH GROWTH STAGES
// =================================================================

type StageInput = {
  name: string;
  orderIndex: number;
  durationDays: number;
  description: string;
  minSoilMoisture: number;
  maxSoilMoisture: number;
  minTemperature: number;
  maxTemperature: number;
  minHumidity: number;
  maxHumidity: number;
  minLightIntensity: number;
  maxLightIntensity: number;
  minNitrogen: number;
  maxNitrogen: number;
  minPhosphorus: number;
  maxPhosphorus: number;
  minPotassium: number;
  maxPotassium: number;
};

type CropInput = {
  name: string;
  variety: string;
  description: string;
  daysToHarvest: number;
  cultivationGuide: string;
  stages: StageInput[];
};

const crops: CropInput[] = [
  {
    name: "Tomato",
    variety: "Diamante Max F1",
    description: "A heat-tolerant determinate tomato variety suited to Philippine lowland conditions, producing firm red fruits.",
    daysToHarvest: 75,
    cultivationGuide: "Transplant healthy seedlings into well-draining soil with full sun exposure. Stake or cage plants once they reach 30 cm. Water consistently at the base, avoiding wet foliage.",
    stages: [
      { name: "Germination", orderIndex: 0, durationDays: 7, description: "Seeds sprout and develop their first true leaves.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 21, maxTemperature: 29, minHumidity: 70, maxHumidity: 90, minLightIntensity: 0, maxLightIntensity: 5000, minNitrogen: 20, maxNitrogen: 50, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 20, maxPotassium: 50 },
      { name: "Vegetative", orderIndex: 1, durationDays: 20, description: "Rapid leaf and stem growth; plant establishes root system.", minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 20, maxTemperature: 29, minHumidity: 60, maxHumidity: 80, minLightIntensity: 5000, maxLightIntensity: 20000, minNitrogen: 80, maxNitrogen: 180, minPhosphorus: 30, maxPhosphorus: 60, minPotassium: 60, maxPotassium: 150 },
      { name: "Flowering", orderIndex: 2, durationDays: 18, description: "Yellow flowers appear; pollination occurs.", minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 26, minHumidity: 60, maxHumidity: 80, minLightIntensity: 8000, maxLightIntensity: 22000, minNitrogen: 50, maxNitrogen: 100, minPhosphorus: 50, maxPhosphorus: 100, minPotassium: 100, maxPotassium: 200 },
      { name: "Fruiting", orderIndex: 3, durationDays: 30, description: "Fruits develop and ripen to harvestable color.", minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 18, maxTemperature: 27, minHumidity: 55, maxHumidity: 75, minLightIntensity: 8000, maxLightIntensity: 25000, minNitrogen: 50, maxNitrogen: 120, minPhosphorus: 40, maxPhosphorus: 80, minPotassium: 120, maxPotassium: 250 },
    ],
  },
  {
    name: "Lettuce",
    variety: "Grand Rapids",
    description: "A loose-leaf lettuce variety preferred for its quick growth and tender, slightly sweet leaves.",
    daysToHarvest: 40,
    cultivationGuide: "Sow directly or transplant 25 cm apart. Lettuce prefers cool weather and partial shade in hot months. Keep soil consistently moist but never waterlogged.",
    stages: [
      { name: "Germination", orderIndex: 0, durationDays: 5, description: "Tiny seeds sprout above the soil surface.", minSoilMoisture: 75, maxSoilMoisture: 90, minTemperature: 15, maxTemperature: 21, minHumidity: 70, maxHumidity: 85, minLightIntensity: 0, maxLightIntensity: 3000, minNitrogen: 15, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 35, minPotassium: 15, maxPotassium: 40 },
      { name: "Seedling", orderIndex: 1, durationDays: 15, description: "Cotyledons expand; first true leaves form.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 13, maxTemperature: 20, minHumidity: 60, maxHumidity: 80, minLightIntensity: 4000, maxLightIntensity: 15000, minNitrogen: 50, maxNitrogen: 100, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 40, maxPotassium: 100 },
      { name: "Head Formation", orderIndex: 2, durationDays: 15, description: "Leaves enlarge and form the harvestable head.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 15, maxTemperature: 22, minHumidity: 60, maxHumidity: 80, minLightIntensity: 5000, maxLightIntensity: 18000, minNitrogen: 60, maxNitrogen: 130, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 60, maxPotassium: 150 },
      { name: "Harvest", orderIndex: 3, durationDays: 5, description: "Heads reach full size; cut at base above the soil line.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 14, maxTemperature: 22, minHumidity: 55, maxHumidity: 75, minLightIntensity: 5000, maxLightIntensity: 18000, minNitrogen: 50, maxNitrogen: 100, minPhosphorus: 25, maxPhosphorus: 45, minPotassium: 50, maxPotassium: 120 },
    ],
  },
  {
    name: "Pechay",
    variety: "Black Behi",
    description: "A native Philippine variety of bok choy with dark green leaves and white succulent stalks.",
    daysToHarvest: 35,
    cultivationGuide: "Sow seeds in well-drained, fertile soil rich in organic matter. Maintain even soil moisture. Thin seedlings to 20 cm apart.",
    stages: [
      { name: "Germination", orderIndex: 0, durationDays: 5, description: "Seeds emerge with first cotyledons visible.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 18, maxTemperature: 22, minHumidity: 70, maxHumidity: 85, minLightIntensity: 0, maxLightIntensity: 3000, minNitrogen: 20, maxNitrogen: 50, minPhosphorus: 15, maxPhosphorus: 35, minPotassium: 20, maxPotassium: 50 },
      { name: "Vegetative", orderIndex: 1, durationDays: 20, description: "Leaves multiply and rosette enlarges quickly.", minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 25, minHumidity: 60, maxHumidity: 80, minLightIntensity: 5000, maxLightIntensity: 15000, minNitrogen: 80, maxNitrogen: 150, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 50, maxPotassium: 150 },
      { name: "Maturity", orderIndex: 2, durationDays: 10, description: "Stalks thicken and the plant reaches harvest size.", minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 25, minHumidity: 55, maxHumidity: 75, minLightIntensity: 5000, maxLightIntensity: 15000, minNitrogen: 70, maxNitrogen: 130, minPhosphorus: 25, maxPhosphorus: 45, minPotassium: 50, maxPotassium: 130 },
    ],
  },
  {
    name: "Eggplant",
    variety: "Mara",
    description: "A long-fruited eggplant variety popular in the Philippines, with deep purple, glossy fruits.",
    daysToHarvest: 85,
    cultivationGuide: "Start seeds in trays and transplant after 4-6 weeks. Plant in full sun with 60 cm spacing. Eggplant is heavy-feeding; side-dress with compost regularly.",
    stages: [
      { name: "Germination", orderIndex: 0, durationDays: 14, description: "Slow-germinating seeds break the surface.", minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 24, maxTemperature: 30, minHumidity: 70, maxHumidity: 90, minLightIntensity: 0, maxLightIntensity: 3000, minNitrogen: 20, maxNitrogen: 50, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 20, maxPotassium: 50 },
      { name: "Vegetative", orderIndex: 1, durationDays: 30, description: "Plants establish strong stems and a full leaf canopy.", minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 22, maxTemperature: 30, minHumidity: 60, maxHumidity: 80, minLightIntensity: 8000, maxLightIntensity: 22000, minNitrogen: 80, maxNitrogen: 180, minPhosphorus: 40, maxPhosphorus: 70, minPotassium: 80, maxPotassium: 200 },
      { name: "Flowering", orderIndex: 2, durationDays: 20, description: "Purple flowers appear; pollination begins.", minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 22, maxTemperature: 30, minHumidity: 55, maxHumidity: 80, minLightIntensity: 10000, maxLightIntensity: 25000, minNitrogen: 60, maxNitrogen: 130, minPhosphorus: 50, maxPhosphorus: 90, minPotassium: 120, maxPotassium: 250 },
      { name: "Fruiting", orderIndex: 3, durationDays: 25, description: "Fruits enlarge and develop glossy purple color.", minSoilMoisture: 55, maxSoilMoisture: 75, minTemperature: 22, maxTemperature: 30, minHumidity: 50, maxHumidity: 75, minLightIntensity: 10000, maxLightIntensity: 25000, minNitrogen: 50, maxNitrogen: 120, minPhosphorus: 40, maxPhosphorus: 80, minPotassium: 150, maxPotassium: 280 },
    ],
  },
];

async function seedCrops() {
  for (const cropData of crops) {
    const { stages, ...cropInfo } = cropData;

    const crop = await prisma.crop.upsert({
      where: { name: cropInfo.name },
      update: cropInfo,
      create: cropInfo,
    });

    for (const stage of stages) {
      await prisma.cropStage.upsert({
        where: { cropId_orderIndex: { cropId: crop.id, orderIndex: stage.orderIndex } },
        update: stage,
        create: { ...stage, cropId: crop.id },
      });
    }
  }
  console.log(`✓ Seeded ${crops.length} crops with growth stages`);
}

// =================================================================
// SAMPLE PLOTS for the school garden demo
// =================================================================
async function seedPlots() {
  const tomato = await prisma.crop.findUnique({
    where: { name: "Tomato" },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  const lettuce = await prisma.crop.findUnique({
    where: { name: "Lettuce" },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  const pechay = await prisma.crop.findUnique({
    where: { name: "Pechay" },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });
  const eggplant = await prisma.crop.findUnique({
    where: { name: "Eggplant" },
    include: { stages: { orderBy: { orderIndex: "asc" } } },
  });

  if (!tomato || !lettuce || !pechay || !eggplant) {
    console.log("⚠ Skipping plots seed - some crops missing");
    return;
  }

  const today = new Date();
  const daysAgo = (n: number) => new Date(today.getTime() - n * 24 * 60 * 60 * 1000);
  const daysFromNow = (n: number) => new Date(today.getTime() + n * 24 * 60 * 60 * 1000);

  const samplePlots = [
    { name: "Plot A1", location: "Greenhouse North", sizeSqm: 6.0, cropId: tomato.id, currentStageId: tomato.stages[1]?.id ?? null, status: "GROWING" as const, plantingDate: daysAgo(28), expectedHarvest: daysFromNow(tomato.daysToHarvest - 28) },
    { name: "Plot A2", location: "Greenhouse North", sizeSqm: 6.0, cropId: tomato.id, currentStageId: tomato.stages[0]?.id ?? null, status: "PLANTED" as const, plantingDate: daysAgo(5), expectedHarvest: daysFromNow(tomato.daysToHarvest - 5) },
    { name: "Plot B1", location: "Outdoor Bed East", sizeSqm: 4.5, cropId: lettuce.id, currentStageId: lettuce.stages[2]?.id ?? null, status: "GROWING" as const, plantingDate: daysAgo(22), expectedHarvest: daysFromNow(lettuce.daysToHarvest - 22) },
    { name: "Plot B2", location: "Outdoor Bed East", sizeSqm: 4.5, cropId: pechay.id, currentStageId: pechay.stages[1]?.id ?? null, status: "GROWING" as const, plantingDate: daysAgo(14), expectedHarvest: daysFromNow(pechay.daysToHarvest - 14) },
    { name: "Plot C1", location: "Outdoor Bed West", sizeSqm: 8.0, cropId: eggplant.id, currentStageId: eggplant.stages[0]?.id ?? null, status: "PREPARING" as const, plantingDate: null, expectedHarvest: null },
    { name: "Plot C2", location: "Outdoor Bed West", sizeSqm: 8.0, cropId: null, currentStageId: null, status: "FALLOW" as const, plantingDate: null, expectedHarvest: null },
  ];

  let created = 0;
  for (const plot of samplePlots) {
    const existing = await prisma.plot.findFirst({ where: { name: plot.name } });
    if (!existing) {
      await prisma.plot.create({ data: plot });
      created++;
    }
  }
  console.log(`✓ Plots: ${created} created, ${samplePlots.length - created} already existed`);
}

// =================================================================
// PLOT ASSIGNMENTS
// =================================================================
async function seedAssignments() {
  const faculty = await prisma.user.findUnique({ where: { email: "maria@h-auto.local" } });
  const pedro = await prisma.user.findUnique({ where: { email: "pedro@h-auto.local" } });
  const juan = await prisma.user.findUnique({ where: { email: "juan@h-auto.local" } });

  if (!faculty || !pedro || !juan) {
    console.log("⚠ Skipping assignments - users missing");
    return;
  }

  const plotA1 = await prisma.plot.findFirst({ where: { name: "Plot A1" } });
  const plotA2 = await prisma.plot.findFirst({ where: { name: "Plot A2" } });
  const plotB1 = await prisma.plot.findFirst({ where: { name: "Plot B1" } });
  const plotB2 = await prisma.plot.findFirst({ where: { name: "Plot B2" } });

  const assignmentData = [
    { plotId: plotA1?.id, studentId: pedro.id, notes: "Tomato - vegetative stage monitoring" },
    { plotId: plotA2?.id, studentId: pedro.id, notes: "Tomato - early growth tracking" },
    { plotId: plotB1?.id, studentId: juan.id, notes: "Lettuce - head formation watch" },
    { plotId: plotB2?.id, studentId: juan.id, notes: "Pechay - vegetative care" },
  ];

  let created = 0;
  for (const a of assignmentData) {
    if (!a.plotId) continue;
    const existing = await prisma.plotAssignment.findFirst({
      where: { plotId: a.plotId, studentId: a.studentId, status: "ACTIVE" },
    });
    if (!existing) {
      await prisma.plotAssignment.create({
        data: {
          plotId: a.plotId,
          studentId: a.studentId,
          facultyId: faculty.id,
          notes: a.notes,
          status: "ACTIVE",
        },
      });
      created++;
    }
  }
  console.log(`✓ Assignments: ${created} created`);
}

// =================================================================
// SAMPLE GROWTH LOGS
// =================================================================
async function seedGrowthLogs() {
  const pedro = await prisma.user.findUnique({ where: { email: "pedro@h-auto.local" } });
  const juan = await prisma.user.findUnique({ where: { email: "juan@h-auto.local" } });

  if (!pedro || !juan) {
    console.log("⚠ Skipping growth logs - users missing");
    return;
  }

  const plotA1 = await prisma.plot.findFirst({
    where: { name: "Plot A1" },
    include: { crop: { include: { stages: { orderBy: { orderIndex: "asc" } } } } },
  });
  const plotA2 = await prisma.plot.findFirst({
    where: { name: "Plot A2" },
    include: { crop: { include: { stages: { orderBy: { orderIndex: "asc" } } } } },
  });
  const plotB1 = await prisma.plot.findFirst({
    where: { name: "Plot B1" },
    include: { crop: { include: { stages: { orderBy: { orderIndex: "asc" } } } } },
  });
  const plotB2 = await prisma.plot.findFirst({
    where: { name: "Plot B2" },
    include: { crop: { include: { stages: { orderBy: { orderIndex: "asc" } } } } },
  });

  // Skip if any logs already exist (idempotent)
  const existingCount = await prisma.growthLog.count();
  if (existingCount > 0) {
    console.log(`✓ Growth logs: ${existingCount} already exist, skipping seed`);
    return;
  }

  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

  // Placeholder image URLs using placehold.co (green theme, descriptive labels)
  const img = (label: string) =>
    `https://placehold.co/800x600/22c55e/white?text=${encodeURIComponent(label)}`;

  const logs = [
    // Plot A1 (Tomato - Vegetative) - Pedro
    {
      plotId: plotA1?.id,
      userId: pedro.id,
      stageId: plotA1?.crop?.stages[1]?.id,
      createdAt: daysAgo(21),
      plantHeightCm: 12,
      leafCount: 8,
      observations: "Healthy young tomato seedlings transplanted last week. Leaves are vibrant green and showing good vigor.",
      notes: "Watered thoroughly at base. Applied light layer of compost mulch.",
      images: [img("Tomato A1 Day 7"), img("Seedlings")],
    },
    {
      plotId: plotA1?.id,
      userId: pedro.id,
      stageId: plotA1?.crop?.stages[1]?.id,
      createdAt: daysAgo(14),
      plantHeightCm: 22,
      leafCount: 14,
      observations: "Significant growth this week. First branches are forming. No signs of pests or disease.",
      notes: "Set up bamboo stakes for support. Watered every other day.",
      images: [img("Tomato A1 Day 14"), img("New Branches")],
    },
    {
      plotId: plotA1?.id,
      userId: pedro.id,
      stageId: plotA1?.crop?.stages[1]?.id,
      createdAt: daysAgo(7),
      plantHeightCm: 35,
      leafCount: 24,
      observations: "Strong vegetative growth continues. Some lower leaves slightly yellowed - possible early nitrogen deficiency.",
      notes: "Applied balanced 14-14-14 fertilizer at base. Will monitor for improvement.",
      images: [img("Tomato A1 Day 21"), img("Leaf Closeup"), img("Stake Support")],
    },
    {
      plotId: plotA1?.id,
      userId: pedro.id,
      stageId: plotA1?.crop?.stages[1]?.id,
      createdAt: daysAgo(2),
      plantHeightCm: 48,
      leafCount: 32,
      observations: "Yellowing has stopped after fertilizer application. New leaves emerging healthy green. Tying main stem to stake.",
      notes: "Trimmed lower suckers to promote vertical growth.",
      images: [img("Tomato A1 Day 26"), img("Tied to Stake")],
    },

    // Plot A2 (Tomato - Germination) - Pedro
    {
      plotId: plotA2?.id,
      userId: pedro.id,
      stageId: plotA2?.crop?.stages[0]?.id,
      createdAt: daysAgo(4),
      plantHeightCm: 2.5,
      leafCount: 2,
      observations: "Cotyledons emerged from soil. About 80% germination rate observed across the plot.",
      notes: "Light watering with mister to avoid disturbing seedlings.",
      images: [img("Tomato A2 Sprouts"), img("First Cotyledons")],
    },
    {
      plotId: plotA2?.id,
      userId: pedro.id,
      stageId: plotA2?.crop?.stages[0]?.id,
      createdAt: daysAgo(1),
      plantHeightCm: 4,
      leafCount: 4,
      observations: "First true leaves appearing. Seedlings looking healthy and uniform.",
      notes: "Thinned overcrowded spots, leaving the strongest seedling per cell.",
      images: [img("Tomato A2 True Leaves")],
    },

    // Plot B1 (Lettuce - Head Formation) - Juan
    {
      plotId: plotB1?.id,
      userId: juan.id,
      stageId: plotB1?.crop?.stages[2]?.id,
      createdAt: daysAgo(15),
      plantHeightCm: 8,
      leafCount: 10,
      observations: "Lettuce heads beginning to form nicely. Cool morning temperatures favorable.",
      notes: "Mulched with rice straw to retain soil moisture.",
      images: [img("Lettuce B1 Day 7"), img("Young Heads")],
    },
    {
      plotId: plotB1?.id,
      userId: juan.id,
      stageId: plotB1?.crop?.stages[2]?.id,
      createdAt: daysAgo(8),
      plantHeightCm: 14,
      leafCount: 18,
      observations: "Heads expanding well. Outer leaves crisp and tender. Approaching harvest size.",
      notes: "Watering daily in the morning to prevent leaf wilt during midday heat.",
      images: [img("Lettuce B1 Day 14"), img("Crisp Leaves"), img("Plot Overview")],
    },
    {
      plotId: plotB1?.id,
      userId: juan.id,
      stageId: plotB1?.crop?.stages[2]?.id,
      createdAt: daysAgo(2),
      plantHeightCm: 18,
      leafCount: 24,
      observations: "Heads are now full size. Ready for first cutting in the next 3-5 days.",
      notes: "Plan to harvest outer leaves first, leaving the heart to continue producing.",
      images: [img("Lettuce B1 Mature"), img("Ready for Harvest")],
    },

    // Plot B2 (Pechay - Vegetative) - Juan
    {
      plotId: plotB2?.id,
      userId: juan.id,
      stageId: plotB2?.crop?.stages[1]?.id,
      createdAt: daysAgo(10),
      plantHeightCm: 6,
      leafCount: 6,
      observations: "Pechay rosettes filling in. Dark green leaves with white stalks - true to variety.",
      notes: "Hand-weeded between rows.",
      images: [img("Pechay B2 Day 4")],
    },
    {
      plotId: plotB2?.id,
      userId: juan.id,
      stageId: plotB2?.crop?.stages[1]?.id,
      createdAt: daysAgo(3),
      plantHeightCm: 12,
      leafCount: 11,
      observations: "Rapid growth observed. Some flea beetle damage on a few outer leaves - minor.",
      notes: "Sprayed neem oil solution as preventive measure.",
      images: [img("Pechay B2 Day 11"), img("Minor Pest Damage")],
    },
  ];

  let created = 0;
  for (const log of logs) {
    if (!log.plotId) continue;
    const { images, ...logData } = log;
    await prisma.growthLog.create({
      data: {
        ...logData,
        images: {
          create: images.map((url) => ({ imageUrl: url })),
        },
      },
    });
    created++;
  }
  console.log(`✓ Growth logs: ${created} sample entries created`);
}

// =================================================================
// MAIN
// =================================================================
async function main() {
  console.log("Starting seed...\n");
  await seedAdmin();
  await seedTestUsers();
  await seedCrops();
  await seedPlots();
  await seedAssignments();
  await seedGrowthLogs();
  console.log("\n✓ Seed complete");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });