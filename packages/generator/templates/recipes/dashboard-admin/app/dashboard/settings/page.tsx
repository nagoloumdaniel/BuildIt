import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function updateName(form: FormData) {
  'use server';
  const name = String(form.get('name') ?? '').trim();
  if (name === '') {
    return;
  }
  await auth.api.updateUser({ headers: await headers(), body: { name } });
  revalidatePath('/dashboard', 'layout');
}

export default async function SettingsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const user = session?.user;

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="font-semibold text-2xl">Paramètres</h1>
      <Card className="space-y-4 p-6">
        <h2 className="font-medium">Profil</h2>
        <form action={updateName} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom</Label>
            <Input id="name" name="name" defaultValue={user?.name} required />
          </div>
          <Button type="submit">Enregistrer</Button>
        </form>
      </Card>
      <Card className="space-y-2 p-6 text-sm">
        <h2 className="font-medium text-base">Compte</h2>
        <p>
          <span className="text-muted-foreground">Email : </span>
          {user?.email}
        </p>
        <p>
          <span className="text-muted-foreground">Email vérifié : </span>
          {user?.emailVerified ? 'oui' : 'non'}
        </p>
      </Card>
    </div>
  );
}
