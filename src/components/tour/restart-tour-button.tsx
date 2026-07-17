"use client";

import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTour, hasTourForRole, getTourForRole } from "@/lib/tour";

export function RestartTourButton() {
  const router = useRouter();
  const { data: session } = useSession();
  const { resetAndRestart } = useTour();

  const role = session?.user?.role;
  if (!role || !hasTourForRole(role)) return null;

  const handleRestart = () => {
    const steps = getTourForRole(role, router);
    if (!steps) {
      console.warn("[tour] No tour steps returned for role", role);
      return;
    }
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
