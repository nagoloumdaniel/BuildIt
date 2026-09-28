'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DailyCount } from '@/lib/signups';

// Objets de configuration hors du JSX : ils ne changent pas d'un rendu à l'autre.
const MARGIN = { top: 8, right: 8, bottom: 0, left: -16 };
const TICK = { fontSize: 12, fill: 'var(--color-muted-foreground)' };

function formatDay(value: string): string {
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function SignupsChart({ data }: { data: readonly DailyCount[] }) {
  const total = data.reduce((sum, day) => sum + day.count, 0);
  return (
    <figure className="mt-4">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...data]} margin={MARGIN}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={TICK}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
              tickFormatter={formatDay}
            />
            <YAxis allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} />
            <Tooltip labelFormatter={(label) => formatDay(String(label))} />
            <Area
              type="monotone"
              dataKey="count"
              name="Inscriptions"
              stroke="var(--color-foreground)"
              fill="var(--color-foreground)"
              fillOpacity={0.08}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 text-muted-foreground text-sm">
        {total} inscription{total > 1 ? 's' : ''} sur la période.
      </figcaption>
    </figure>
  );
}
