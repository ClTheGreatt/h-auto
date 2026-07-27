import Link from "next/link";
import { Sprout, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
      <div className="text-center max-w-md page-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 mb-6 shadow-lg">
          <Sprout className="w-8 h-8 text-white" />
        </div>
        <div className="text-7xl font-bold text-gray-200 mb-2">404</div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild className="bg-green-600 hover:bg-green-700">
          <Link href="/dashboard">
            <Home className="w-4 h-4 mr-2" />
            Back to dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}