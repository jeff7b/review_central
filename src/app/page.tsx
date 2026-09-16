
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, LogIn } from 'lucide-react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const useStubAuth = process.env.NEXT_PUBLIC_STUB_AUTH === 'true';

  useEffect(() => {
    // If we are using stub auth and the user is not authenticated yet,
    // automatically trigger the sign-in process.
    if (useStubAuth && status === 'unauthenticated') {
      signIn('credentials', { callbackUrl: '/dashboard' });
      return; // Early return to avoid other logic paths in this effect
    }

    // If the user is authenticated (either through stub or real auth),
    // redirect them to the dashboard.
    if (status === 'authenticated') {
      router.push('/dashboard');
    }
  }, [session, status, router, useStubAuth]);

  // While signing in or redirecting, show a loading message.
  if (status === 'loading' || status === 'authenticated' || (useStubAuth && status === 'unauthenticated')) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <p>Signing in or redirecting...</p>
      </div>
    );
  }

  // This part of the component will now only be rendered for the real (non-stub) auth flow
  // when the user is unauthenticated.
  const handleLogin = () => {
    // This is now only for the Azure AD flow since stub auth is automatic
    signIn('azure-ad', { callbackUrl: '/dashboard' });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm mb-2">
            <Building2 className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-headline">Review Central</h1>
          <p className="text-xs text-muted-foreground">Enterprise Performance & Review Management</p>
        </div>

        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="space-y-1.5 text-center pb-4">
            <CardTitle className="text-xl font-semibold font-headline">Welcome back</CardTitle>
            <CardDescription className="text-xs">
              Sign in with your organization Microsoft 365 credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleLogin} className="w-full h-11 text-sm font-medium shadow-sm">
              <LogIn className="mr-2 h-4 w-4" />
              Sign in with Office 365
            </Button>
            <div className="rounded-md bg-muted/60 border border-border/50 p-3 text-center">
              <p className="text-[11px] text-muted-foreground">
                Corporate Single Sign-On (SSO) enabled. No password required.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col items-center pt-2 pb-6 border-t border-border/40 text-center">
            <p className="text-xs text-muted-foreground">
              Need assistance? <Link href="#" className="font-medium text-primary hover:underline">Contact IT Helpdesk</Link>
            </p>
          </CardFooter>
        </Card>

        <footer className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Review Central Enterprise. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
