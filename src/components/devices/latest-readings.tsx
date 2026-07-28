"use client";

import {
  Droplets,
  Thermometer,
  Cloud,
  Sun,
  Leaf,
  Sprout,
  Beaker,
  type LucideIcon,
} from "lucide-react";
import {
  SENSOR_FIELDS,
  type SensorReadingValues,
  type StageThresholds,
} from "@/lib/sensors/threshold-status";
import { ThresholdBar } from "@/components/sensors/threshold-bar";

type Reading = SensorReadingValues & {
  id: string;
  recordedAt: Date;
};

type Stage = StageThresholds | null;

const FIELD_ICONS: Record<keyof SensorReadingValues, LucideIcon> = {
  soilMoisture: Droplets,
  temperature: Thermometer,
  humidity: Cloud,
  lightIntensity: Sun,
  nitrogen: Leaf,
  phosphorus: Sprout,
  potassium: Beaker,
};

export function LatestReadings({
  reading,
  stage,
}: {
  reading: Reading | null;
  stage: Stage;
}) {
  if (!reading) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No sensor readings yet. Once a device is linked and reporting, data will
        appear here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Last updated {new Date(reading.recordedAt).toLocaleString()}
      </p>
      {!stage && (
        <p className="text-xs text-muted-foreground italic">
          No stage set — thresholds unavailable.
        </p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {SENSOR_FIELDS.map((field) => {
          const Icon = FIELD_ICONS[field.key];
          const value = reading[field.key];
          return (
            <div key={field.key} className="border rounded-md p-3 bg-muted">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              {stage ? (
                <ThresholdBar
                  label={field.label}
                  value={value}
                  unit={field.unit}
                  min={stage[field.minField]}
                  max={stage[field.maxField]}
                />
              ) : (
                <>
                  <div className="text-xs text-muted-foreground">{field.label}</div>
                  <div className="font-semibold">
                    {value != null ? `${value} ${field.unit}` : "—"}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
