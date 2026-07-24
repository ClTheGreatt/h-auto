"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteUserDialog } from "@/components/users/delete-user-dialog";

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
}: {
  userId: string;
  userName: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DeleteUserDialog
          userId={userId}
          userName={userName}
          trigger={
            <DropdownMenuItem
              onSelect={(e) => e.preventDefault()}
              className="text-red-600 focus:text-red-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Deactivate
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
