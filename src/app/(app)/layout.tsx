"use client";

import { SiteHeader } from '@/components/site-header';
import { MainNav } from '@/components/main-nav';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PanelLeftOpen, PanelRightOpen, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false); // For localStorage hydration

  useEffect(() => {
    setIsMounted(true);
    const storedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (storedSidebarState) {
      setIsSidebarCollapsed(JSON.parse(storedSidebarState));
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sidebarCollapsed', JSON.stringify(isSidebarCollapsed));
    }
  }, [isSidebarCollapsed, isMounted]);

  useEffect(() => {
    // Only redirect if mounted and the session status is determined
    if (isMounted && sessionStatus === 'unauthenticated') {
      redirect('/');
    }
  }, [isMounted, sessionStatus]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  // Show loading state while session is loading or component is not yet mounted
  if (!isMounted || sessionStatus === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading session...</p>
      </div>
    );
  }
  
  // If unauthenticated after loading, user will be redirected by useEffect. 
  // Can return null or a minimal message here as redirect should occur.
  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p>Redirecting to login...</p>
      </div>
    );
  }

  // If authenticated and mounted, render the layout
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <div className="flex flex-1">
        <aside className={cn(
          "hidden md:flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-60"
        )}>
          <ScrollArea className="flex-1 py-2">
            <MainNav isCollapsed={isSidebarCollapsed} />
          </ScrollArea>
          <div className="p-2.5 border-t border-border bg-card">
            <Button
              variant="ghost"
              size={isSidebarCollapsed ? "icon" : "sm"}
              onClick={toggleSidebar}
              className={cn("w-full text-muted-foreground hover:text-foreground", !isSidebarCollapsed && "justify-start px-2.5 text-xs font-medium")}
            >
              {isSidebarCollapsed ? (
                <PanelRightOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftOpen className="mr-2 h-4 w-4" />
                  <span>Collapse sidebar</span>
                </>
              )}
              <span className="sr-only">{isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
            </Button>
          </div>
        </aside>
        <main className="flex-1 overflow-x-hidden bg-background">
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
             {children}
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
