"use client"; // Make this a client component as it uses useSession

import Link from 'next/link';
import { UserNav } from '@/components/user-nav';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, Building2, LogIn } from 'lucide-react';
import { MainNav } from '@/components/main-nav';
import { ModeToggle } from '@/components/mode-toggle';
import { useSession } from 'next-auth/react';

export function SiteHeader() {
  const { data: session, status } = useSession();
  const isLoggedIn = status === 'authenticated';

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-90">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-foreground font-headline">
                  Review Central
                </span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                  Enterprise
                </span>
              </div>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <ModeToggle />
          {isLoggedIn && session?.user ? (
            <UserNav />
          ) : (
            <Button asChild size="sm" className="font-medium">
              <Link href="/">
                <LogIn className="mr-2 h-4 w-4" />
                Sign In
              </Link>
            </Button>
          )}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9">
                  <Menu className="h-4 w-4" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <div className="border-b border-border p-4">
                  <Link href="/dashboard" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm tracking-tight text-foreground font-headline block">
                        Review Central
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Performance Management
                      </span>
                    </div>
                  </Link>
                </div>
                <div className="p-3">
                  <MainNav isMobile={true} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
