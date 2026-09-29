'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/dashboard', label: 'Vue d’ensemble' },
  { href: '/dashboard/users', label: 'Utilisateurs' },
  { href: '/dashboard/settings', label: 'Paramètres' },
] as const;

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Tableau de bord" className="flex gap-1 md:flex-col">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm transition hover:bg-muted',
              active && 'bg-muted font-medium',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
