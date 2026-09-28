import { Card } from '@/components/ui/card';

/**
 * Page d'accueil du projet.
 *
 * Elle existe pour que `pnpm dev` montre quelque chose au premier lancement,
 * et pour lister ce qui est déjà câblé. Remplacez-la : c'est votre projet.
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <header className="space-y-3">
        <h1 className="text-balance font-semibold text-4xl tracking-tight">{{projectName}}</h1>
        <p className="text-pretty text-lg text-muted-foreground">{{description}}</p>
      </header>

      <Card className="space-y-4 p-6">
        <h2 className="font-medium text-sm uppercase tracking-wide text-muted-foreground">
          Déjà câblé
        </h2>
        <ul className="space-y-2 text-sm">
          <li>Next.js, TypeScript strict et Tailwind</li>
          <li>Lint, tests et vérification de types — voir les scripts du package.json</li>
          <li>Variables d’environnement listées dans .env.example</li>
        </ul>
      </Card>

      <p className="text-sm text-muted-foreground">
        Rien ici ne dépend de l’outil qui a généré ce projet. Modifiez, supprimez, recommencez.
      </p>
    </main>
  );
}
