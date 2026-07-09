export type AlertSuggestion = {
  title: string;
  steps: string[];
};

type SensorMeta = {
  label: string;
  unit: string;
  decimals: number;
  direction: "below" | "above";
};

const SENSOR_META: Record<string, SensorMeta> = {
  LOW_SOIL_MOISTURE: { label: "Soil moisture", unit: "%", decimals: 0, direction: "below" },
  HIGH_SOIL_MOISTURE: { label: "Soil moisture", unit: "%", decimals: 0, direction: "above" },
  LOW_TEMPERATURE: { label: "Temperature", unit: "°C", decimals: 1, direction: "below" },
  HIGH_TEMPERATURE: { label: "Temperature", unit: "°C", decimals: 1, direction: "above" },
  LOW_HUMIDITY: { label: "Humidity", unit: "%", decimals: 0, direction: "below" },
  HIGH_HUMIDITY: { label: "Humidity", unit: "%", decimals: 0, direction: "above" },
  LOW_LIGHT: { label: "Light intensity", unit: " lux", decimals: 0, direction: "below" },
  HIGH_LIGHT: { label: "Light intensity", unit: " lux", decimals: 0, direction: "above" },
  LOW_NITROGEN: { label: "Nitrogen", unit: " mg/kg", decimals: 1, direction: "below" },
  HIGH_NITROGEN: { label: "Nitrogen", unit: " mg/kg", decimals: 1, direction: "above" },
  LOW_PHOSPHORUS: { label: "Phosphorus", unit: " mg/kg", decimals: 1, direction: "below" },
  HIGH_PHOSPHORUS: { label: "Phosphorus", unit: " mg/kg", decimals: 1, direction: "above" },
  LOW_POTASSIUM: { label: "Potassium", unit: " mg/kg", decimals: 1, direction: "below" },
  HIGH_POTASSIUM: { label: "Potassium", unit: " mg/kg", decimals: 1, direction: "above" },
};

type SuggestionDef = {
  title: string;
  diagnosticFallback: string;
  actionSteps: string[];
};

const SUGGESTIONS: Record<string, SuggestionDef> = {
  LOW_SOIL_MOISTURE: {
    title: "Water the plant",
    diagnosticFallback: "Confirm the current soil moisture reading at the plot.",
    actionSteps: [
      "Water the plot until soil moisture returns within the ideal range.",
      "Check the irrigation line or dripper for clogs or disconnection.",
      "Recheck the soil moisture reading after 30-60 minutes.",
    ],
  },
  HIGH_SOIL_MOISTURE: {
    title: "Reduce watering",
    diagnosticFallback: "Confirm the current soil moisture reading at the plot.",
    actionSteps: [
      "Pause irrigation until soil moisture drops back within range.",
      "Check for drainage issues or blocked outlets.",
      "Watch for signs of root rot or fungal growth.",
    ],
  },
  LOW_TEMPERATURE: {
    title: "Warm the environment",
    diagnosticFallback: "Confirm the current temperature reading at the plot.",
    actionSteps: [
      "Cover the plot or move potted plants to a warmer, sheltered spot.",
      "Add mulch to help retain soil heat.",
      "Consider a grow light or heat source if temperatures stay low overnight.",
    ],
  },
  HIGH_TEMPERATURE: {
    title: "Cool down the area",
    diagnosticFallback: "Confirm the current temperature reading at the plot.",
    actionSteps: [
      "Provide shade using a net or cover during peak sun hours.",
      "Increase watering frequency to help the plant cope with heat stress.",
      "Improve airflow around the plot if possible.",
    ],
  },
  LOW_HUMIDITY: {
    title: "Increase humidity",
    diagnosticFallback: "Confirm the current humidity reading at the plot.",
    actionSteps: [
      "Mist the plants or surrounding area with water.",
      "Group plants closer together to raise local humidity.",
      "Add a humidity tray or damp mulch near the base.",
    ],
  },
  HIGH_HUMIDITY: {
    title: "Improve ventilation",
    diagnosticFallback: "Confirm the current humidity reading at the plot.",
    actionSteps: [
      "Increase airflow around the plot with fans or by opening vents.",
      "Space out plants to reduce moisture buildup.",
      "Check leaves for early signs of fungal disease.",
    ],
  },
  LOW_LIGHT: {
    title: "Increase light exposure",
    diagnosticFallback: "Confirm the current light intensity reading at the plot.",
    actionSteps: [
      "Move the plot or plant to an area with more direct sunlight.",
      "Trim overhanging branches or leaves that block light.",
      "Consider a supplemental grow light.",
    ],
  },
  HIGH_LIGHT: {
    title: "Provide shade",
    diagnosticFallback: "Confirm the current light intensity reading at the plot.",
    actionSteps: [
      "Install a shade net during peak sunlight hours.",
      "Move potted plants to a partially shaded location.",
      "Monitor leaves for signs of sunscald or wilting.",
    ],
  },
  LOW_NITROGEN: {
    title: "Fertilize the plant",
    diagnosticFallback: "Confirm the current nitrogen reading at the plot.",
    actionSteps: [
      "Apply a nitrogen-rich fertilizer following the recommended dosage.",
      "Recheck nutrient levels after a few days to confirm improvement.",
      "Avoid overwatering, which can leach nitrogen from the soil.",
    ],
  },
  HIGH_NITROGEN: {
    title: "Reduce fertilizing",
    diagnosticFallback: "Confirm the current nitrogen reading at the plot.",
    actionSteps: [
      "Pause nitrogen-based fertilizer application.",
      "Water the soil to help dilute and flush excess nitrogen.",
      "Watch for excessive leaf growth with poor fruiting or flowering.",
    ],
  },
  LOW_PHOSPHORUS: {
    title: "Fertilize the plant",
    diagnosticFallback: "Confirm the current phosphorus reading at the plot.",
    actionSteps: [
      "Apply a phosphorus-rich fertilizer following the recommended dosage.",
      "Check soil pH, since it affects phosphorus absorption.",
      "Recheck nutrient levels after a few days to confirm improvement.",
    ],
  },
  HIGH_PHOSPHORUS: {
    title: "Reduce fertilizing",
    diagnosticFallback: "Confirm the current phosphorus reading at the plot.",
    actionSteps: [
      "Pause phosphorus-based fertilizer application.",
      "Water the soil to help dilute excess phosphorus.",
      "Watch for signs of nutrient lockout, such as yellowing leaves.",
    ],
  },
  LOW_POTASSIUM: {
    title: "Fertilize the plant",
    diagnosticFallback: "Confirm the current potassium reading at the plot.",
    actionSteps: [
      "Apply a potassium-rich fertilizer following the recommended dosage.",
      "Recheck nutrient levels after a few days to confirm improvement.",
      "Avoid overwatering, which can leach potassium from the soil.",
    ],
  },
  HIGH_POTASSIUM: {
    title: "Reduce fertilizing",
    diagnosticFallback: "Confirm the current potassium reading at the plot.",
    actionSteps: [
      "Pause potassium-based fertilizer application.",
      "Water the soil to help dilute excess potassium.",
      "Watch for signs of nutrient imbalance, such as calcium or magnesium deficiency.",
    ],
  },
  DEVICE_OFFLINE: {
    title: "Check the device",
    diagnosticFallback: "Confirm whether the ESP32 device is powered on and reachable.",
    actionSteps: [
      "Check the device's Wi-Fi connection and signal strength.",
      "Restart the device if it's unresponsive.",
      "Verify the device is still physically connected to the plot's sensors.",
    ],
  },
};

function diagnosticLine(
  meta: SensorMeta,
  currentValue: number,
  threshold: number,
  unitOverride?: string
): string {
  const unit = unitOverride ?? meta.unit;
  const cur = currentValue.toFixed(meta.decimals);
  const thr = threshold.toFixed(meta.decimals);
  return `${meta.label} is at ${cur}${unit} (${meta.direction} ${thr}${unit} threshold).`;
}

export function buildAlertSuggestion(input: {
  type: string;
  currentValue?: number | null;
  threshold?: number | null;
  unit?: string;
}): AlertSuggestion | null {
  const def = SUGGESTIONS[input.type];
  if (!def) return null;

  const meta = SENSOR_META[input.type];
  const diagnostic =
    meta && input.currentValue != null && input.threshold != null
      ? diagnosticLine(meta, input.currentValue, input.threshold, input.unit)
      : def.diagnosticFallback;

  return {
    title: def.title,
    steps: [diagnostic, ...def.actionSteps],
  };
}
