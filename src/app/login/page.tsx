"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import {
  Sprout,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Lock,
  Leaf,
  Droplets,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        toast.error(
          result.code === "rate_limited"
            ? "Too many failed attempts. Please try again in about 15 minutes."
            : "Invalid email or password"
        );
        setSubmitting(false);
        return;
      }

      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Theme toggle - fixed so it stays visible over either panel at any breakpoint */}
      <div className="fixed top-4 right-4 z-50 rounded-lg bg-white/10 dark:bg-black/20 backdrop-blur-sm">
        <ThemeToggle />
      </div>

      {/* Left side - Brand panel (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-green-600 via-green-700 to-emerald-800 dark:from-green-900 dark:via-emerald-950 dark:to-gray-950 overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white dark:bg-emerald-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-32 right-16 w-80 h-80 bg-green-300 dark:bg-emerald-700/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/3 w-72 h-72 bg-emerald-400 dark:bg-emerald-600/20 rounded-full blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Top: Logo + system name */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Sprout className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="text-xl font-bold">H-Auto</div>
              <div className="text-xs text-green-100 dark:text-emerald-200">Smart Gardening</div>
            </div>
          </div>

          {/* Middle: Headline */}
          <div className="space-y-6 max-w-md">
            <h1 className="text-4xl font-bold leading-tight">
              Cultivating the future of school gardens
            </h1>
            <p className="text-green-100 dark:text-emerald-200 text-lg leading-relaxed">
              Real-time monitoring of soil moisture, temperature, humidity, light,
              and nutrients — all from one intelligent platform.
            </p>

            {/* Feature highlights */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Droplets className="w-5 h-5" />
                </div>
                <div className="text-xs text-green-100 dark:text-emerald-200">Moisture tracking</div>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Sun className="w-5 h-5" />
                </div>
                <div className="text-xs text-green-100 dark:text-emerald-200">Light analytics</div>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-white/15 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <Leaf className="w-5 h-5" />
                </div>
                <div className="text-xs text-green-100 dark:text-emerald-200">Growth monitoring</div>
              </div>
            </div>
          </div>

          {/* Bottom: Attribution */}
          <div className="text-sm text-green-100/80">
            <div>Bataan Peninsula State University</div>
            <div className="text-xs mt-1 text-green-100/60">
              Capstone Project | College of CCST
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-stone-50 dark:bg-gray-950">
        <div className="w-full max-w-md space-y-8 page-fade-in">
          {/* Mobile logo (only shown on small screens) */}
          <div className="lg:hidden flex items-center gap-3 justify-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-sm">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">H-Auto</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Smart Gardening</div>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Sign in to access your monitoring dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                Email address
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11"
                  disabled={submitting}
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10 h-11"
                  disabled={submitting}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="default"
              disabled={submitting}
              className="w-full h-11 transition"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4 border-t border-gray-200 dark:border-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Need an account? Contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}