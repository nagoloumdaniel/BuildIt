import { z } from 'zod';

/**
 * Le contrat entre l'application web et l'API : une seule définition, que
 * l'API respecte (test de contrat) et que le web valide à la réception.
 */
export const HealthSchema = z.object({ status: z.literal('ok') });

export type Health = z.infer<typeof HealthSchema>;

/** Client typé de l'API : chaque réponse est validée contre le contrat. */
export function createApiClient(baseUrl: string) {
  return {
    async health(): Promise<Health> {
      const response = await fetch(new URL('/health', baseUrl));
      if (!response.ok) {
        throw new Error(`L’API répond ${response.status} sur /health.`);
      }
      return HealthSchema.parse(await response.json());
    },
  };
}
