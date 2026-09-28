import { db } from './db';
import { type DailyCount, signupsByDay } from './signups';

const DAY = 24 * 60 * 60 * 1000;

export interface Overview {
  readonly totalUsers: number;
  readonly newUsers: number;
  readonly activeSessions: number;
  readonly signups: DailyCount[];
}

/**
 * Indicateurs de la vue d'ensemble, calculés sur les tables de Better Auth :
 * des données réelles dès le premier compte créé, jamais d'exemple inventé.
 */
export async function overview(now: Date = new Date()): Promise<Overview> {
  const [totalUsers, newUsers, activeSessions, recent] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    db.session.count({ where: { expiresAt: { gt: now } } }),
    db.user.findMany({
      where: { createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      select: { createdAt: true },
    }),
  ]);
  return {
    totalUsers,
    newUsers,
    activeSessions,
    signups: signupsByDay(
      recent.map((user) => user.createdAt),
      now,
    ),
  };
}
