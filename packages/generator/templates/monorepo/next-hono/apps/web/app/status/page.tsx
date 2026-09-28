import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';

// Interrogée à chaque requête : l'état de l'API ne se fige pas au build.
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  let state: string;
  try {
    const health = await api.health();
    state = `API joignable — ${health.status}`;
  } catch (error) {
    state = `API injoignable : ${error instanceof Error ? error.message : String(error)}`;
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <h1 className="font-semibold text-3xl">État des services</h1>
      <Card className="p-6">
        <p>{state}</p>
      </Card>
    </main>
  );
}
