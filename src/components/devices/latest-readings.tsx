"use client";

import {
  Droplets,
  Thermometer,
  Cloud,
  Sun,
  Leaf,
  Sprout,
  Beaker,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Reading = {
  id: string;
  recordedAt: Date;
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lightIntensity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
};

type Stage = {
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
} | null;

function statusFor(value: number | null, min: number, max: number) {
  if (value == null) return { label: "—", color: "text-gray-400" };
  if (value < min) return { label: "Low", color: "text-blue-600" };
  if (value > max) return { label: "High", color: "text-red-600" };
  return { label: "Optimal", color: "text-green-600" };
}

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

  const items = [
    {
      label: "Soil moisture",
      icon: Droplets,
      value: reading.soilMoisture,
      unit: "%",
      status: stage
        ? statusFor(
            reading.soilMoisture,
            stage.minSoilMoisture,
            stage.maxSoilMoisture
          )
        : null,
    },
    {
      label: "Temperature",
      icon: Thermometer,
      value: reading.temperature,
      unit: "°C",
      status: stage
        ? statusFor(reading.temperature, stage.minTemperature, stage.maxTemperature)
        : null,
    },
    {
      label: "Humidity",
      icon: Cloud,
      value: reading.humidity,
      unit: "%",
      status: stage
        ? statusFor(reading.humidity, stage.minHumidity, stage.maxHumidity)
        : null,
    },
    {
      label: "Light intensity",
      icon: Sun,
      value: reading.lightIntensity,
      unit: "lux",
      status: stage
        ? statusFor(
            reading.lightIntensity,
            stage.minLightIntensity,
            stage.maxLightIntensity
          )
        : null,
    },
    {
      label: "Nitrogen",
      icon: Leaf,
      value: reading.nitrogen,
      unit: "mg/kg",
      status: stage
        ? statusFor(reading.nitrogen, stage.minNitrogen, stage.maxNitrogen)
        : null,
    },
    {
      label: "Phosphorus",
      icon: Sprout,
      value: reading.phosphorus,
      unit: "mg/kg",
      status: stage
        ? statusFor(reading.phosphorus, stage.minPhosphorus, stage.maxPhosphorus)
        : null,
    },
    {
      label: "Potassium",
      icon: Beaker,
      value: reading.potassium,
      unit: "mg/kg",
      status: stage
        ? statusFor(reading.potassium, stage.minPotassium, stage.maxPotassium)
        : null,
    },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Last updated {new Date(reading.recordedAt).toLocaleString()}
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="border rounded-md p-3 bg-muted"
            >
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-gray-400" />
                {item.status && (
                  <Badge
                    variant="secondary"
                    className={`text-xs ${item.status.color}`}
                  >
                    {item.status.label}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-semibold">
                {item.value != null ? `${item.value} ${item.unit}` : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}