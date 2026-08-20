"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Client Component: the expand/collapse state (open/closed) is local UI
// state with no server data behind it, so it has to live somewhere that can
// hold useState. Plot Detail itself is a Server Component and cannot attach
// interactivity directly — this card takes the guide as a plain string prop
// (fully serializable across the RSC boundary) and owns the toggle itself,
// the same shape of fix used for the Assignments page's nested dialog in an
// earlier batch.
export function CultivationGuideCard({ guide }: { guide: string | null }) {
  const [open, setOpen] = useState(false);
  const hasGuide = !!guide && guide.trim().length > 0;

  return (
    <Card>
      <Collapsible open={hasGuide && open} onOpenChange={setOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger
            disabled={!hasGuide}
            className="flex w-full items-center justify-between text-left disabled:cursor-default"
          >
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Cultivation guide
            </CardTitle>
            {hasGuide && (
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  open && "rotate-180"
                )}
              />
            )}
          </CollapsibleTrigger>
        </CardHeader>
        {hasGuide ? (
          <CollapsibleContent>
            <CardContent>
              {/* Stored as plain text with blank-line-separated sections
                  (e.g. "Planting: ...\n\nWatering: ..."), not markdown or
                  HTML — whitespace-pre-wrap preserves that structure and
                  wraps long lines, with no parsing/markdown library
                  needed. */}
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {guide}
              </p>
            </CardContent>
          </CollapsibleContent>
        ) : (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No cultivation guide has been added for this crop yet.
            </p>
          </CardContent>
        )}
      </Collapsible>
    </Card>
  );
}
