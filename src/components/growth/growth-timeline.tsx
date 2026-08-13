"use client";

import { useState } from "react";
import {
  Ruler,
  Leaf,
  Calendar,
  Trash2,
  Sprout,
  ChevronLeft,
  ChevronRight,
  X,
  Droplets,
  Thermometer,
  Wind,
  Sun,
  FlaskConical,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteLogDialog } from "./delete-log-dialog";
import { formatDateTime } from "@/lib/format-date";

type LogItem = {
  id: string;
  plantHeightCm: number | null;
  leafCount: number | null;
  soilMoisture: number | null;
  temperature: number | null;
  humidity: number | null;
  lightIntensity: number | null;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  observations: string | null;
  notes: string | null;
  createdAt: Date;
  stage: { name: string } | null;
  user: { id: string; firstName: string; lastName: string };
  images: { id: string; imageUrl: string }[];
};

export function GrowthTimeline({
  logs,
  currentUserId,
  isAdmin,
}: {
  logs: LogItem[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [lightbox, setLightbox] = useState<{
    images: { imageUrl: string }[];
    index: number;
  } | null>(null);

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        <Sprout className="w-8 h-8 mx-auto text-gray-300 mb-2" />
        No growth logs yet for this plot.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {logs.map((log, idx) => {
          const initials =
            `${log.user.firstName[0]}${log.user.lastName[0]}`.toUpperCase();
          const canDelete = log.user.id === currentUserId || isAdmin;
          const isLast = idx === logs.length - 1;

          return (
            <div key={log.id} className="flex gap-4 relative">
              {/* Timeline dot + line */}
              <div className="relative flex-shrink-0">
                <Avatar className="w-10 h-10 ring-4 ring-white">
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!isLast && (
                  <div className="absolute left-1/2 top-10 w-0.5 h-full -translate-x-1/2 bg-gray-200" />
                )}
              </div>

              {/* Log content */}
              <div className="flex-1 min-w-0 pb-4">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-sm font-medium">
                    {log.user.firstName} {log.user.lastName}
                  </span>
                  {log.stage && (
                    <Badge variant="secondary" className="text-xs">
                      {log.stage.name}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(log.createdAt)}
                  </span>
                  {canDelete && (
                    <DeleteLogDialog
                      logId={log.id}
                      trigger={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-7 w-7 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                  )}
                </div>

                <div className="bg-card border rounded-md p-4 space-y-3">
                  {(log.plantHeightCm != null || log.leafCount != null) && (
                    <div className="flex gap-4 text-sm">
                      {log.plantHeightCm != null && (
                        <div className="flex items-center gap-1.5">
                          <Ruler className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">
                            {log.plantHeightCm} cm tall
                          </span>
                        </div>
                      )}
                      {log.leafCount != null && (
                        <div className="flex items-center gap-1.5">
                          <Leaf className="w-4 h-4 text-gray-400" />
                          <span className="text-muted-foreground">
                            {log.leafCount} leaves
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {log.observations && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        OBSERVATIONS
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {log.observations}
                      </p>
                    </div>
                  )}

                  {log.notes && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">
                        NOTES
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {log.notes}
                      </p>
                    </div>
                  )}

                  {(log.soilMoisture != null ||
                    log.temperature != null ||
                    log.humidity != null ||
                    log.lightIntensity != null ||
                    log.nitrogen != null ||
                    log.phosphorus != null ||
                    log.potassium != null) && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">
                        CONDITIONS AT TIME OF LOG
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                        {log.soilMoisture != null && (
                          <span className="flex items-center gap-1.5">
                            <Droplets className="w-4 h-4 text-blue-400" />
                            {log.soilMoisture}% soil
                          </span>
                        )}
                        {log.temperature != null && (
                          <span className="flex items-center gap-1.5">
                            <Thermometer className="w-4 h-4 text-red-400" />
                            {log.temperature}°C
                          </span>
                        )}
                        {log.humidity != null && (
                          <span className="flex items-center gap-1.5">
                            <Wind className="w-4 h-4 text-cyan-400" />
                            {log.humidity}% humidity
                          </span>
                        )}
                        {log.lightIntensity != null && (
                          <span className="flex items-center gap-1.5">
                            <Sun className="w-4 h-4 text-amber-400" />
                            {log.lightIntensity} lux
                          </span>
                        )}
                        {(log.nitrogen != null ||
                          log.phosphorus != null ||
                          log.potassium != null) && (
                          <span className="flex items-center gap-1.5">
                            <FlaskConical className="w-4 h-4 text-green-500" />
                            NPK: {log.nitrogen ?? "—"}/{log.phosphorus ?? "—"}/{log.potassium ?? "—"} mg/kg
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {log.images.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                      {log.images.map((img, i) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() =>
                            setLightbox({ images: log.images, index: i })
                          }
                          className="aspect-square rounded overflow-hidden bg-muted hover:opacity-90 transition"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.imageUrl}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
          >
            <X className="w-6 h-6" />
          </button>

          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox({
                  ...lightbox,
                  index:
                    (lightbox.index - 1 + lightbox.images.length) %
                    lightbox.images.length,
                });
              }}
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.images[lightbox.index].imageUrl}
            alt="Full size"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {lightbox.images.length > 1 && (
            <button
              type="button"
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                setLightbox({
                  ...lightbox,
                  index: (lightbox.index + 1) % lightbox.images.length,
                });
              }}
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
            {lightbox.index + 1} / {lightbox.images.length}
          </div>
        </div>
      )}
    </>
  );
}