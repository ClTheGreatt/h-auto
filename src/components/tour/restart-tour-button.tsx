"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour } from "@/lib/tour";
import { createStudentTour } from "@/lib/tour/tours/student";

export function RestartTourButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const { resetAndRestart } = useTour();

  if (!session?.user) return null;

  // NOTE: For B2c, visible to all signed-in users for testing.
  // B2d will gate this to roles that have a tour defined.

  const handleRestart = () => {
    const steps = createStudentTour(router);
    resetAndRestart(steps);
  };

  return (
    <Button onClick={handleRestart} variant="outline" size="sm">
      <PlayCircle className="mr-2 h-4 w-4" />
      Start tour
    </Button>
  );
}
