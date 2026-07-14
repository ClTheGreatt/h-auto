"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour, hasTourForRole } from "@/lib/tour";
import { createStudentTour } from "@/lib/tour/tours/student";

export function RestartTourButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const { resetAndRestart } = useTour();

  const role = session?.user?.role;
  if (!role || !hasTourForRole(role)) return null;

  const handleRestart = () => {
    const steps = createStudentTour(router);
    resetAndRestart(steps);
  };

  return (
    <Button
      data-tour="help.restart-tour-button"
      onClick={handleRestart}
      variant="outline"
      size="sm"
    >
      <PlayCircle className="mr-2 h-4 w-4" />
      Start tour
    </Button>
  );
}
