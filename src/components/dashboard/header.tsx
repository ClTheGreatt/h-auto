"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, User as UserIcon, ChevronDown } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { MobileSidebar } from "./mobile-sidebar";

type UserRole = "SUPER_ADMIN" | "ADMIN" | "FACULTY" | "STUDENT_FARMER";

export function Header({
  firstName,
  lastName,
  email,
  role,
  image,
}: {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  image?: string | null;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`;
  const roleLabel = role.toLowerCase().replace("_", " ");

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirect: false });
    router.push("/login");
    router.refresh();
  }

  return (
  <header className="h-16 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left: Mobile menu trigger */}
      <div className="flex items-center gap-3">
        <MobileSidebar role={role} />
      </div>

      {/* Right: Theme toggle + user dropdown */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex items-center gap-3 h-auto py-1.5 px-2 hover:bg-muted"
          >
        <Avatar className="w-9 h-9">
              {image && <AvatarImage src={image} alt={fullName} />}
              <AvatarFallback className="bg-green-100 text-green-700 font-medium text-sm">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-left">
              <div className="text-sm font-medium text-foreground">{fullName}</div>
              <div className="text-xs text-muted-foreground capitalize">{roleLabel}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-400 hidden md:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col gap-1">
              <span className="font-medium">{fullName}</span>
              <span className="text-xs text-muted-foreground font-normal truncate">
                {email}
              </span>
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 capitalize w-fit mt-1 text-xs"
              >
                {roleLabel}
              </Badge>
            </div>
          </DropdownMenuLabel>
        <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile" className="cursor-pointer">
              <UserIcon className="w-4 h-4 mr-2" />
              Profile & Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {signingOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}