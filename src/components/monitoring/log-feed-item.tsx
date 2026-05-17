"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ruler, Leaf, ChevronRight, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

type LogProps = {
  id: string;
  plotId: string;
  plotName: string;
  cropName?: string | null;
  stageName?: string | null;
  authorName: string;
  authorInitials: string;
  createdAt: Date;
  observations: string | null;
  notes: string | null;
  plantHeightCm: number | null;
  leafCount: number | null;
  images: { id: string; imageUrl: string }[];
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function LogFeedItem({ log }: { log: LogProps }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function prevImage(e: React.MouseEvent) {
    e.stopPropagation();
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  }

  function nextImage(e: React.MouseEvent) {
    e.stopPropagation();
    if (lightboxIndex !== null && lightboxIndex < log.images.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  }

  return (
    <>
      <article className="bg-white border rounded-lg overflow-hidden hover:shadow-sm transition flex flex-col">
        {/* Header */}
        <div className="p-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className="bg-green-100 text-green-700 text-xs font-medium">
                {log.authorInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm truncate">
                  {log.authorName}
                </span>
                <span className="text-gray-400 text-xs">logged</span>
                <Link
                  href={`/dashboard/plots/${log.plotId}`}
                  className="text-sm font-medium text-green-700 hover:underline truncate"
                >
                  {log.plotName}
                </Link>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {log.cropName && (
                  <Badge variant="secondary" className="text-xs h-5">
                    {log.cropName}
                  </Badge>
                )}
                {log.stageName && (
                  <Badge
                    variant="secondary"
                    className="text-xs h-5 bg-green-100 text-green-700"
                  >
                    {log.stageName}
                  </Badge>
                )}
                <span className="text-xs text-gray-400">
                  {timeAgo(log.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <Link
            href={`/dashboard/plots/${log.plotId}`}
            className="text-xs text-gray-400 hover:text-green-700 flex items-center flex-shrink-0"
            aria-label="View plot details"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Photos - constrained sizing */}
        {log.images.length > 0 && (
          <>
            {log.images.length === 1 ? (
              // Single image: 16:9 ratio (not too tall)
              <button
                onClick={() => setLightboxIndex(0)}
                className="relative aspect-[16/9] overflow-hidden bg-gray-100 group block w-full"
              >
                <Image
                  src={log.images[0].imageUrl}
                  alt="Growth photo"
                  fill
                  className="object-cover group-hover:scale-105 transition-transform"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </button>
            ) : (
              // Multi: smaller grid
              <div
                className={
                  "grid gap-0.5 " +
                  (log.images.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-3")
                }
              >
                {log.images.slice(0, 6).map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setLightboxIndex(idx)}
                    className="relative aspect-square overflow-hidden bg-gray-100 group"
                  >
                    <Image
                      src={img.imageUrl}
                      alt={`Growth photo ${idx + 1}`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform"
                      sizes="(max-width: 768px) 33vw, 16vw"
                    />
                    {idx === 5 && log.images.length > 6 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white font-medium text-sm">
                        +{log.images.length - 6}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Content */}
        <div className="p-3 space-y-1.5 flex-1">
          {log.observations && (
            <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
              {log.observations}
            </p>
          )}

          {(log.plantHeightCm || log.leafCount) && (
            <div className="flex items-center gap-3 text-xs text-gray-500 pt-1">
              {log.plantHeightCm && (
                <span className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  {log.plantHeightCm} cm
                </span>
              )}
              {log.leafCount && (
                <span className="flex items-center gap-1">
                  <Leaf className="w-3 h-3" />
                  {log.leafCount} leaves
                </span>
              )}
            </div>
          )}

          {log.notes && (
            <p className="text-xs text-gray-500 italic pt-1.5 border-t mt-1.5 line-clamp-2">
              Note: {log.notes}
            </p>
          )}
        </div>
      </article>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-full z-10"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
            <Image
              src={log.images[lightboxIndex].imageUrl}
              alt={`Photo ${lightboxIndex + 1}`}
              width={1200}
              height={800}
              className="max-w-full max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
              priority
            />

            {log.images.length > 1 && (
              <>
                {lightboxIndex > 0 && (
                  <button
                    onClick={prevImage}
                    className="absolute left-4 text-white p-3 hover:bg-white/10 rounded-full"
                    aria-label="Previous"
                  >
                    <ChevronRight className="w-6 h-6 rotate-180" />
                  </button>
                )}
                {lightboxIndex < log.images.length - 1 && (
                  <button
                    onClick={nextImage}
                    className="absolute right-4 text-white p-3 hover:bg-white/10 rounded-full"
                    aria-label="Next"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded-full">
            {lightboxIndex + 1} / {log.images.length}
          </div>
        </div>
      )}
    </>
  );
}