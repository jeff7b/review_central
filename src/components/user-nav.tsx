"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon, Settings, LayoutDashboard } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import type { User as AppUserType } from '@/types'; // Using custom User type for structure

export function UserNav() {
  const { data: session } = useSession();

  const getInitials = (name?: string | null) => {
    if (!name) return 'U';
    const names = name.split(' ');
    let initials = names[0].substring(0, 1).toUpperCase();
    if (names.length > 1) {
      initials += names[names.length - 1].substring(0, 1).toUpperCase();
    }
    return initials;
  };

  // Adapt session user to the structure expected by DropdownMenuLabel if needed
  // For now, directly use session.user properties.
  // The `AppUserType` in props was for mock data, now we use session.
  const user = session?.user;
  const userRole = (user as any)?.role || 'employee';
  const appUser: AppUserType | undefined = user ? {
    id: (user as any).id || 'default-id',
    name: user.name || 'User',
    email: user.email || 'No email',
    avatarUrl: user.image || undefined,
    role: userRole,
  } : undefined;

  if (!appUser) {
    return null; 
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full ring-1 ring-border hover:ring-primary/40 transition-all p-0">
          <Avatar className="h-8 w-8">
            <AvatarImage src={appUser.avatarUrl} alt={appUser.name} data-ai-hint="user avatar" />
            <AvatarFallback className="text-xs font-medium bg-muted text-foreground">{getInitials(appUser.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 p-1.5 shadow-md border-border" align="end" forceMount>
        <DropdownMenuLabel className="font-normal px-2 py-1.5">
          <div className="flex flex-col space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground leading-none">{appUser.name}</p>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase capitalize">
                {appUser.role.replace('_', ' ')}
              </span>
            </div>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {appUser.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="text-xs cursor-pointer">
            <Link href="/dashboard" className="flex items-center">
              <LayoutDashboard className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
              <span>Dashboard</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-xs opacity-60">
            <UserIcon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>Profile</span>
            <DropdownMenuShortcut className="text-[10px]">⇧⌘P</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem disabled className="text-xs opacity-60">
            <Settings className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
            <span>Settings</span>
            <DropdownMenuShortcut className="text-[10px]">⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/' })} className="text-xs text-destructive focus:text-destructive cursor-pointer">
          <LogOut className="mr-2 h-3.5 w-3.5" />
          <span>Log out</span>
          <DropdownMenuShortcut className="text-[10px]">⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
