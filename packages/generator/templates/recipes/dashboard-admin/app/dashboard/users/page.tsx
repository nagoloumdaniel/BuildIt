import { UsersTable } from '@/components/dashboard/users-table';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, email: true, emailVerified: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-2xl">Utilisateurs</h1>
      <UsersTable
        users={users.map((user) => ({ ...user, createdAt: user.createdAt.toISOString() }))}
      />
    </div>
  );
}
