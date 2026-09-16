
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Home, Users, ScrollText, UserCheck, UserCog, CalendarClock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";


interface NavLink {
  href: string;
  label: string;
  icon: React.ReactNode;
  roles?: Array<'employee' | 'team_leader' | 'admin'>;
}

interface NavSection {
  title?: string;
  links: NavLink[];
}

const navSections: NavSection[] = [
  {
    title: "Workspace",
    links: [
      { href: "/dashboard", label: "My Dashboard", icon: <Home className="h-4 w-4" />, roles: ['employee', 'team_leader', 'admin'] },
      { href: "/team-dashboard", label: "Team Dashboard", icon: <Users className="h-4 w-4" />, roles: ['team_leader', 'admin'] },
    ]
  },
  {
    title: "Administration",
    links: [
      { href: "/admin/staff", label: "Manage Staff", icon: <UserCog className="h-4 w-4" />, roles: ['admin'] },
      { href: "/admin/review-cycles", label: "Review Cycles", icon: <CalendarClock className="h-4 w-4" />, roles: ['admin'] },
      { href: "/admin/questionnaires", label: "Questionnaires", icon: <ScrollText className="h-4 w-4" />, roles: ['admin'] },
      { href: "/admin/assignments", label: "Assignments", icon: <UserCheck className="h-4 w-4" />, roles: ['admin'] },
    ]
  }
];

export function MainNav({ isMobile = false, isCollapsed = false }: { isMobile?: boolean; isCollapsed?: boolean }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const currentUserRole = session?.user?.role ?? 'employee';

  const visibleSections = navSections.map(section => ({
    ...section,
    links: section.links.filter(link => !link.roles || link.roles.includes(currentUserRole))
  })).filter(section => section.links.length > 0);

  if (isCollapsed && !isMobile) {
    return (
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-1.5 px-2 py-3">
          {visibleSections.map((section, sIdx) => (
            <div key={section.title || sIdx} className="flex flex-col items-center gap-1.5 w-full">
              {sIdx > 0 && <div className="my-1.5 h-px w-8 bg-border" />}
              {section.links.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
                return (
                  <Tooltip key={link.href} delayDuration={0}>
                    <TooltipTrigger asChild>
                      <Link
                        href={link.href}
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                          isActive && "bg-primary/10 text-primary hover:bg-primary/15 font-medium"
                        )}
                      >
                        {link.icon}
                        <span className="sr-only">{link.label}</span>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="font-medium text-xs">
                      {link.label}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>
      </TooltipProvider>
    );
  }
  
  return (
    <nav className={cn("flex flex-col gap-4 px-3 py-3", isMobile ? "space-y-3" : "")}>
      {visibleSections.map((section, sIdx) => (
        <div key={section.title || sIdx} className="space-y-1">
          {section.title && (
            <div className="px-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">
              {section.title}
            </div>
          )}
          <div className="space-y-0.5">
            {section.links.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
                    isActive && "bg-primary/10 text-primary font-semibold hover:bg-primary/15",
                    isMobile && "text-sm py-2.5 px-3"
                  )}
                >
                  <span className={cn(
                    "transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {link.icon}
                  </span>
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
