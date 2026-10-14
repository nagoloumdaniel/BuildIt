# Le code généré ne dépend pas de BuildIt

C'est le principe fondateur du produit (§1), et il est vérifié par un test
automatisé pas seulement affirmé.

> **Principe de non-dépendance (no-lock-in)** à afficher explicitement dans le
> produit et la documentation : le code généré est autonome, sans dépendance
> runtime à BuildIt. Quitter l'outil après génération ne casse rien.
> [Cahier des charges, §1](../cahier-des-charges.md)

## Ce que le projet généré contient

Un projet SaaS généré (`pnpm pf create mon-projet --preset saas`) : 34 fichiers,
dont un `package.json` qui ne dépend que de paquets publics.

```text
$ grep -r "@buildit" mon-projet
(aucune occurrence)
```

```json
{
  "name": "mon-projet",
  "dependencies": {
    "@prisma/adapter-pg": ">=7.0.0 <8.0.0",
    "@prisma/client": ">=7.0.0 <8.0.0",
    "@sentry/nextjs": "^10.0.0",
    "better-auth": ">=1.0.0 <2.0.0",
    "next": ">=15.0.0 <17.0.0",
    "react": "^19.0.0",
    "stripe": "^18.0.0"
  }
}
```

*(extrait réel du `package.json` généré ; la liste complète tient en 13
dépendances de production et 9 de développement, toutes upstream.)*

Aucun paquet propriétaire, aucun fichier de configuration qui pointerait vers
nous, aucun appel réseau vers un service BuildIt : le catalogue est
embarqué dans l'outil, le projet généré n'en a pas besoin.

## Le test qui le prouve

`packages/generator/src/pipeline.test.ts`, groupe
« **le projet généré ne dépend pas de BuildIt §1** », deux tests :

| Test | Ce qu'il fait |
|---|---|
| `aucun fichier ne référence un paquet @buildit` | Génère un vrai projet dans un dossier temporaire, parcourt **tous** ses fichiers récursivement, et échoue si l'un d'eux contient `@buildit/` |
| `le package.json ne contient aucune dépendance vers l'outil` | Vérifie que ni `dependencies` ni `devDependencies` ne contient un nom commençant par `@buildit/` |

```text
$ pnpm --filter @buildit/generator exec vitest run src/pipeline.test.ts -t "ne dépend pas de BuildIt"

 RUN  v5.0.1 D:/Projets/BuildIt/packages/generator

 Test Files  1 passed (1)
      Tests  2 passed | 51 skipped (53)
   Duration  1.05s
```

Le test parcourt les fichiers, il ne relit pas une liste écrite à la main : une
nouvelle intégration qui importerait un paquet de l'outil dans un template ferait
échouer la CI au prochain push le gate M6 du [§10 de la
roadmap](../roadmap.md) l'exige (« No-lock-in vérifié par un test automatisé,
pas par relecture »).

## Le projet généré le dit lui-même

Le `README.md` du projet généré se termine par :

> Ce projet a été généré par BuildIt. Il est **autonome** : aucune
> dépendance à BuildIt ne subsiste. Vous pouvez désinstaller l'outil,
> rien ne cassera.

## Ce dont vous dépendez quand même honnêtement

- **Des paquets upstream** : Next.js, Prisma, Stripe… C'est le principe même du
  produit : vous obtenez le code que vous auriez écrit, avec ses dépendances
  normales.
- **D'un gestionnaire de paquets** : `packageManager` épingle `pnpm@11.13.1`, et
  `pnpm-workspace.yaml` déclare les autorisations de scripts d'installation
  (`allowBuilds`) deux fichiers que vous pouvez changer, mais qu'il faut changer
  consciemment.
- **Des choix par défaut du preset** : versions, scripts, structure. Tous sont
  dans vos fichiers.

Ce dont vous **ne** dépendez pas : un compte, une licence d'usage, un service en
ligne, un format propriétaire. Le manifest est un JSON, le plan est une liste de
fichiers, et le projet est du code.

## Vérifier vous-même

```bash
pnpm pf create mon-projet --preset saas --dir /tmp/mon-projet --no-install --no-git --yes
grep -r "@buildit" /tmp/mon-projet        # rien
grep -c "buildit" /tmp/mon-projet/package.json   # 0
```

Ces deux commandes refont à la main ce que fait le test ci-dessus c'est
exactement la vérification qui a été faite ici sur un projet réellement généré :
aucune occurrence.

Et si vous voulez partir sans jamais générer : `pf template show saas --name
mon-projet` imprime le manifest, que vous pouvez relire, versionner, ou passer à
`pf generate` plus tard ou ne pas passer du tout.
