import { SignupsChart } from '@/components/dashboard/signups-chart';
import { Card } from '@/components/ui/card';
import { overview } from '@/lib/dashboard';

// Données en direct : jamais calculées une fois pour toutes au build.
export const dynamic = 'force-dynamic';

export default async function OverviewPage() {
  const data = await overview();
  const kpis = [
    { label: 'Utilisateurs', value: data.totalUsers },
    { label: 'Nouveaux sur 7 jours', value: data.newUsers },
    { label: 'Sessions actives', value: data.activeSessions },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-semibold text-2xl">Vue d’ensemble</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <p className="text-muted-foreground text-sm">{kpi.label}</p>
            <p className="mt-2 font-semibold text-3xl tabular-nums">
              {kpi.value.toLocaleString('fr-FR')}
            </p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <h2 className="font-medium">Inscriptions — 30 derniers jours</h2>
        <SignupsChart data={data.signups} />
      </Card>
    </div>
  );
}
