export type PresetStage = {
  name: string;
  description: string;
  durationDays: number;
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

export type CropPreset = {
  id: string;
  displayName: string;
  name: string;
  daysToHarvest: number;
  description: string;
  cultivationGuide: string;
  stages: PresetStage[];
};

export const CROP_PRESETS: CropPreset[] = [
  {
    id: "eggplant",
    displayName: "Eggplant (Talong)",
    name: "Eggplant",
    daysToHarvest: 90,
    description:
      "Warm-season vegetable widely cultivated in the Philippines. Prefers full sun and well-drained loamy soil.",
    cultivationGuide:
      "Planting: Sow seeds in seedbeds 30 days before transplanting. Transplant when seedlings have 4-6 true leaves at a spacing of 60 cm between plants.\n\nWatering: Water regularly, especially during flowering and fruit development. Avoid waterlogging which can cause root rot.\n\nFertilizing: Apply complete fertilizer (14-14-14) at planting. Side-dress with urea 30 days after transplanting, then again at flowering.\n\nHarvest: Pick fruits when glossy and firm, 65-90 days after transplanting. Harvest every 2-3 days to encourage continuous production.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 10,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 22, maxTemperature: 30,
        minHumidity: 70, maxHumidity: 85, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vegetative",
        description: "Leaf and stem development, root establishment.",
        durationDays: 30,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 23, maxTemperature: 30,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 40, maxNitrogen: 80, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 20,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 22, maxTemperature: 28,
        minHumidity: 55, maxHumidity: 75, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 30, maxNitrogen: 60, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 40, maxPotassium: 70,
      },
      {
        name: "Fruiting",
        description: "Fruit development and maturation.",
        durationDays: 30,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 22, maxTemperature: 30,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 20000, maxLightIntensity: 40000,
        minNitrogen: 30, maxNitrogen: 60, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 50, maxPotassium: 80,
      },
    ],
  },
  {
    id: "tomato",
    displayName: "Tomato",
    name: "Tomato",
    daysToHarvest: 75,
    description:
      "Popular warm-season fruit vegetable with high demand in Philippine markets. Grows best in well-drained soil with full sun exposure.",
    cultivationGuide:
      "Planting: Sow seeds in seedbeds and transplant after 3-4 weeks at 50 cm spacing. Stake or cage plants to support fruit weight.\n\nWatering: Keep soil consistently moist; avoid wetting foliage to reduce disease risk. Water deeply 2-3 times a week.\n\nFertilizing: Apply complete fertilizer (14-14-14) at transplanting. Increase potassium during flowering and fruiting for better fruit quality.\n\nHarvest: Pick fruits when they turn from green to breaker (light red blush), 60-75 days after transplanting. Harvest every 2-3 days.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 8,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 20, maxTemperature: 28,
        minHumidity: 70, maxHumidity: 85, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vegetative",
        description: "Leaf and stem development, root establishment.",
        durationDays: 25,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 21, maxTemperature: 29,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 40, maxNitrogen: 80, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 17,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 20, maxTemperature: 27,
        minHumidity: 55, maxHumidity: 75, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 30, maxNitrogen: 60, minPhosphorus: 30, maxPhosphorus: 55, minPotassium: 40, maxPotassium: 70,
      },
      {
        name: "Fruiting",
        description: "Fruit development and ripening.",
        durationDays: 25,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 20, maxTemperature: 28,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 20000, maxLightIntensity: 40000,
        minNitrogen: 30, maxNitrogen: 55, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 55, maxPotassium: 90,
      },
    ],
  },
  {
    id: "pechay",
    displayName: "Pechay (Bok Choy)",
    name: "Pechay",
    daysToHarvest: 40,
    description:
      "Fast-growing leafy vegetable that is a staple in Filipino cooking. Prefers cool, moist conditions and nutrient-rich soil.",
    cultivationGuide:
      "Planting: Direct-seed or transplant seedlings at 15-20 cm spacing. Grows best in loose, organic-rich soil.\n\nWatering: Keep soil consistently moist; leafy growth suffers quickly under water stress. Water lightly but frequently.\n\nFertilizing: Apply nitrogen-rich fertilizer at planting and again 2 weeks later to support fast leaf growth.\n\nHarvest: Harvest whole plants 35-45 days after sowing, or pick outer leaves progressively for a longer harvest window.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 7,
        minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 18, maxTemperature: 26,
        minHumidity: 75, maxHumidity: 90, minLightIntensity: 2000, maxLightIntensity: 6000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 25, minPotassium: 15, maxPotassium: 25,
      },
      {
        name: "Vegetative",
        description: "Rapid leaf growth.",
        durationDays: 23,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 25,
        minHumidity: 65, maxHumidity: 85, minLightIntensity: 10000, maxLightIntensity: 20000,
        minNitrogen: 50, maxNitrogen: 90, minPhosphorus: 20, maxPhosphorus: 35, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Maturity",
        description: "Leaves reach harvestable size.",
        durationDays: 10,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 25,
        minHumidity: 65, maxHumidity: 85, minLightIntensity: 10000, maxLightIntensity: 20000,
        minNitrogen: 40, maxNitrogen: 70, minPhosphorus: 20, maxPhosphorus: 35, minPotassium: 30, maxPotassium: 50,
      },
    ],
  },
  {
    id: "mustasa",
    displayName: "Mustasa (Mustard Greens)",
    name: "Mustasa",
    daysToHarvest: 35,
    description:
      "Fast-maturing leafy green with a peppery flavor, widely grown in home gardens and small plots for local consumption.",
    cultivationGuide:
      "Planting: Direct-seed thinly in rows or beds at 10-15 cm spacing. Thin seedlings once established.\n\nWatering: Water lightly and frequently to keep soil moist; avoid letting the bed dry out between waterings.\n\nFertilizing: Apply a nitrogen-rich fertilizer at planting and a light side-dress 2 weeks in for fast, tender leaf growth.\n\nHarvest: Harvest by cutting whole plants or picking outer leaves starting 30-35 days after sowing.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 6,
        minSoilMoisture: 70, maxSoilMoisture: 85, minTemperature: 18, maxTemperature: 27,
        minHumidity: 75, maxHumidity: 90, minLightIntensity: 2000, maxLightIntensity: 6000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 25, minPotassium: 15, maxPotassium: 25,
      },
      {
        name: "Vegetative",
        description: "Rapid leaf growth.",
        durationDays: 21,
        minSoilMoisture: 60, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 27,
        minHumidity: 65, maxHumidity: 85, minLightIntensity: 10000, maxLightIntensity: 20000,
        minNitrogen: 45, maxNitrogen: 85, minPhosphorus: 20, maxPhosphorus: 35, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Maturity",
        description: "Leaves reach harvestable size.",
        durationDays: 8,
        minSoilMoisture: 60, maxSoilMoisture: 80, minTemperature: 18, maxTemperature: 27,
        minHumidity: 65, maxHumidity: 85, minLightIntensity: 10000, maxLightIntensity: 20000,
        minNitrogen: 40, maxNitrogen: 65, minPhosphorus: 20, maxPhosphorus: 35, minPotassium: 30, maxPotassium: 50,
      },
    ],
  },
  {
    id: "kangkong",
    displayName: "Kangkong (Water Spinach)",
    name: "Kangkong",
    daysToHarvest: 30,
    description:
      "Semi-aquatic leafy vegetable that thrives in moist to waterlogged soil. One of the fastest-growing and most tolerant vegetables in the tropics.",
    cultivationGuide:
      "Planting: Direct-seed or plant stem cuttings in moist beds or paddies at 15-20 cm spacing.\n\nWatering: Keep soil saturated to waterlogged at all times; kangkong tolerates and even prefers standing water.\n\nFertilizing: Apply nitrogen-rich fertilizer at planting and again after each cutting to encourage regrowth.\n\nHarvest: Cut shoots 25-30 days after planting, 15-20 cm from the base. Regrows for multiple harvests every 2-3 weeks.",
    stages: [
      {
        name: "Germination",
        description: "Seeds or cuttings establish roots.",
        durationDays: 5,
        minSoilMoisture: 75, maxSoilMoisture: 95, minTemperature: 22, maxTemperature: 32,
        minHumidity: 75, maxHumidity: 90, minLightIntensity: 2000, maxLightIntensity: 6000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 10, maxPhosphorus: 20, minPotassium: 15, maxPotassium: 25,
      },
      {
        name: "Vegetative",
        description: "Rapid vine and leaf growth.",
        durationDays: 18,
        minSoilMoisture: 75, maxSoilMoisture: 95, minTemperature: 24, maxTemperature: 33,
        minHumidity: 70, maxHumidity: 90, minLightIntensity: 10000, maxLightIntensity: 25000,
        minNitrogen: 40, maxNitrogen: 80, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 25, maxPotassium: 45,
      },
      {
        name: "Maturity",
        description: "Shoots reach harvestable length.",
        durationDays: 7,
        minSoilMoisture: 75, maxSoilMoisture: 95, minTemperature: 24, maxTemperature: 33,
        minHumidity: 70, maxHumidity: 90, minLightIntensity: 10000, maxLightIntensity: 25000,
        minNitrogen: 35, maxNitrogen: 65, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 25, maxPotassium: 45,
      },
    ],
  },
  {
    id: "ampalaya",
    displayName: "Ampalaya (Bitter Gourd)",
    name: "Ampalaya",
    daysToHarvest: 90,
    description:
      "Climbing vine vegetable valued for its bitter fruit and medicinal properties. Requires trellising and full sun exposure.",
    cultivationGuide:
      "Planting: Sow seeds directly or in seedbeds; transplant at 60-80 cm spacing along a trellis. Provide support as vines develop.\n\nWatering: Water regularly, especially during flowering and fruiting. Avoid waterlogging at the base of the vine.\n\nFertilizing: Apply complete fertilizer (14-14-14) at planting. Side-dress with potassium-rich fertilizer during flowering and fruiting.\n\nHarvest: Pick fruits while still green and firm, 55-65 days after transplanting. Harvest every 2-3 days for continuous production.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 10,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 24, maxTemperature: 32,
        minHumidity: 70, maxHumidity: 85, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vining",
        description: "Vine growth and trellis establishment.",
        durationDays: 30,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 24, maxTemperature: 32,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 40, maxNitrogen: 80, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 55,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 20,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 23, maxTemperature: 30,
        minHumidity: 55, maxHumidity: 75, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 30, maxNitrogen: 60, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 40, maxPotassium: 70,
      },
      {
        name: "Fruiting",
        description: "Fruit development and maturation.",
        durationDays: 30,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 23, maxTemperature: 31,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 20000, maxLightIntensity: 40000,
        minNitrogen: 30, maxNitrogen: 55, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 50, maxPotassium: 85,
      },
    ],
  },
  {
    id: "sitaw",
    displayName: "Sitaw (Yardlong Bean)",
    name: "Sitaw",
    daysToHarvest: 65,
    description:
      "Long, slender legume popular in Filipino dishes. A nitrogen-fixing vine that benefits from trellis support and needs less added nitrogen than most vegetables.",
    cultivationGuide:
      "Planting: Direct-seed at 30-40 cm spacing along a trellis or stake. Provide support early as vines climb quickly.\n\nWatering: Water regularly but avoid waterlogging; beans are sensitive to soggy soil.\n\nFertilizing: Apply a light complete fertilizer at planting; avoid excess nitrogen since legumes fix their own. Side-dress with potassium during flowering and pod formation.\n\nHarvest: Pick pods while young and tender, 55-65 days after sowing. Harvest every 2-3 days to keep plants productive.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 8,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 24, maxTemperature: 32,
        minHumidity: 65, maxHumidity: 80, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 15, maxNitrogen: 30, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vegetative",
        description: "Vine growth and trellis establishment.",
        durationDays: 22,
        minSoilMoisture: 55, maxSoilMoisture: 70, minTemperature: 24, maxTemperature: 32,
        minHumidity: 60, maxHumidity: 75, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 25, maxNitrogen: 50, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 15,
        minSoilMoisture: 55, maxSoilMoisture: 70, minTemperature: 23, maxTemperature: 30,
        minHumidity: 55, maxHumidity: 70, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 20, maxNitrogen: 45, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 40, maxPotassium: 65,
      },
      {
        name: "Fruiting",
        description: "Pod development and maturation.",
        durationDays: 20,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 23, maxTemperature: 31,
        minHumidity: 60, maxHumidity: 75, minLightIntensity: 20000, maxLightIntensity: 38000,
        minNitrogen: 20, maxNitrogen: 45, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 45, maxPotassium: 75,
      },
    ],
  },
  {
    id: "kalabasa",
    displayName: "Kalabasa (Squash)",
    name: "Kalabasa",
    daysToHarvest: 100,
    description:
      "Sprawling vine crop producing large, long-storing fruit. Needs generous spacing and rich, well-drained soil.",
    cultivationGuide:
      "Planting: Sow seeds directly in hills spaced 1-1.5 m apart to allow for vine spread.\n\nWatering: Water deeply once or twice a week; increase frequency during flowering and fruit set.\n\nFertilizing: Apply complete fertilizer (14-14-14) at planting. Side-dress with potassium-rich fertilizer during flowering and fruiting for fruit development.\n\nHarvest: Harvest mature fruits 90-100 days after sowing, when the rind is hard and fully colored. Cure in a dry area for longer storage.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 10,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 24, maxTemperature: 32,
        minHumidity: 70, maxHumidity: 85, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vining",
        description: "Vine growth and canopy establishment.",
        durationDays: 35,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 23, maxTemperature: 31,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 45, maxNitrogen: 85, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 55,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 20,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 22, maxTemperature: 30,
        minHumidity: 55, maxHumidity: 75, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 30, maxNitrogen: 60, minPhosphorus: 30, maxPhosphorus: 55, minPotassium: 40, maxPotassium: 70,
      },
      {
        name: "Fruiting",
        description: "Fruit development and maturation.",
        durationDays: 35,
        minSoilMoisture: 65, maxSoilMoisture: 80, minTemperature: 22, maxTemperature: 30,
        minHumidity: 60, maxHumidity: 80, minLightIntensity: 20000, maxLightIntensity: 40000,
        minNitrogen: 30, maxNitrogen: 55, minPhosphorus: 30, maxPhosphorus: 55, minPotassium: 55, maxPotassium: 90,
      },
    ],
  },
  {
    id: "okra",
    displayName: "Okra",
    name: "Okra",
    daysToHarvest: 60,
    description:
      "Heat-tolerant pod vegetable that thrives in hot, humid tropical weather with minimal care and few pest problems.",
    cultivationGuide:
      "Planting: Direct-seed at 30-40 cm spacing in full sun. Soak seeds overnight before sowing to speed germination.\n\nWatering: Water regularly, especially during flowering and pod set. Okra tolerates brief dry spells once established.\n\nFertilizing: Apply complete fertilizer (14-14-14) at planting. Side-dress with potassium-rich fertilizer during flowering.\n\nHarvest: Pick pods young and tender, 2-3 days after flowering, about 50-60 days after sowing. Harvest every 1-2 days to keep pods from becoming fibrous.",
    stages: [
      {
        name: "Germination",
        description: "Seeds sprout and develop cotyledons.",
        durationDays: 8,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 25, maxTemperature: 33,
        minHumidity: 65, maxHumidity: 80, minLightIntensity: 3000, maxLightIntensity: 8000,
        minNitrogen: 20, maxNitrogen: 40, minPhosphorus: 15, maxPhosphorus: 30, minPotassium: 15, maxPotassium: 30,
      },
      {
        name: "Vegetative",
        description: "Leaf and stem development.",
        durationDays: 20,
        minSoilMoisture: 55, maxSoilMoisture: 70, minTemperature: 25, maxTemperature: 33,
        minHumidity: 60, maxHumidity: 78, minLightIntensity: 15000, maxLightIntensity: 30000,
        minNitrogen: 40, maxNitrogen: 75, minPhosphorus: 20, maxPhosphorus: 40, minPotassium: 30, maxPotassium: 50,
      },
      {
        name: "Flowering",
        description: "Flower production and pollination.",
        durationDays: 12,
        minSoilMoisture: 55, maxSoilMoisture: 70, minTemperature: 24, maxTemperature: 32,
        minHumidity: 55, maxHumidity: 72, minLightIntensity: 20000, maxLightIntensity: 35000,
        minNitrogen: 30, maxNitrogen: 55, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 40, maxPotassium: 65,
      },
      {
        name: "Fruiting",
        description: "Pod development and maturation.",
        durationDays: 20,
        minSoilMoisture: 60, maxSoilMoisture: 75, minTemperature: 24, maxTemperature: 32,
        minHumidity: 60, maxHumidity: 78, minLightIntensity: 20000, maxLightIntensity: 38000,
        minNitrogen: 25, maxNitrogen: 50, minPhosphorus: 30, maxPhosphorus: 50, minPotassium: 45, maxPotassium: 75,
      },
    ],
  },
];
