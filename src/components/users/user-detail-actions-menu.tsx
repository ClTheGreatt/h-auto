"use client";

import { MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import type { UserStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";
import { ReactivateUserDialog } from "@/components/users/reactivate-user-dialog";

// Client Component wrapper for the user detail page's "..." menu. The
// caller (the detail page) is a Server Component — constructing a
// DropdownMenuItem with an inline onSelect handler directly in server code
// and passing it as a prop across the RSC boundary throws "Event handlers
// cannot be passed to Client Component props" on every render. Keeping the
// whole menu (including its event handlers) inside this "use client" module
// avoids that boundary crossing entirely.
export function UserDetailActionsMenu({
  userId,
  userName,
  userEmail,
  userStatus,
  canManage,
}: {
  userId: string;
  userName: string;
  userEmail: string;
  userStatus: UserStatus;
  // Resolved server-side (canManageUser) — whether the viewer is allowed to
  // deactivate this specific account. Only ever false for an Admin/Super
  // Admin target viewed by a plain Admin. Gates the Deactivate item below;
  // the server action enforces the same rule regardless.
  canManage: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {userStatus === "INACTIVE" ? (
          <ReactivateUserDialog
            userId={userId}
            userName={userName}
            userEmail={userEmail}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reactivate
              </DropdownMenuItem>
            }
          />
        ) : (
          canManage && (
            <DeleteUserDialog
              userId={userId}
              userName={userName}
              trigger={
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-danger-text focus:text-danger-text"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
              }
            />
          )
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
