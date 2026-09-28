import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { DashboardNav } from '@/components/dashboard/nav';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { auth } from '@/lib/auth';

/**
 * Tout ce qui est sous /dashboard exige une session. La vérification a lieu
 * côté serveur, à chaque requête : aucune page protégée n'est envoyée avant.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) {
    redirect('/sign-in');
  }

  return (
    <div className="grid min-h-dvh md:grid-cols-[15rem_1fr]">
      <aside className="border-border border-b p-4 md:border-r md:border-b-0">
        <p className="mb-6 px-3 font-semibold">{{projectName}}</p>
        <DashboardNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center justify-end gap-4 border-border border-b px-6">
          <span className="text-muted-foreground text-sm">{session.user.email}</span>
          <SignOutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
