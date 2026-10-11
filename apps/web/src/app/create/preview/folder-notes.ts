/**
 * Une phrase par dossier racine (§6.12).
 *
 * `tree.ts` dit explicitement qu'un nom reste opaque — il ne l'interprète pas.
 * Cette table l'interprète, mais à part, et seulement pour les noms que ce
 * générateur produit vraiment (grep sur `packages/generator/templates` et
 * `monorepo.ts`) : jamais une liste générique recopiée d'ailleurs, et jamais
 * plus profond que la racine — un `src/lib` d'un preset n'a pas le même sens
 * qu'un `src/lib` d'un autre.
 *
 * Un dossier absent de la table n'affiche rien : silencieux, pas une excuse
 * inventée.
 */
const ROOT_FOLDER_NOTES: Readonly<Record<string, string>> = {
  apps: 'Les applications déployables du projet — une par cible (web, api…).',
  packages: 'Le code partagé entre applications : types, client API, composants communs.',
  src: 'Le code source de l’application.',
  app: 'Les routes — un dossier par URL (App Router de Next.js).',
  components: 'Les composants d’interface réutilisés par plusieurs écrans.',
  lib: 'Les fonctions partagées : accès aux données, logique métier, utilitaires.',
  prisma: 'Le schéma de base de données et les migrations.',
  public: 'Les fichiers servis tels quels : images, polices, favicon.',
  e2e: 'Les tests qui pilotent l’application dans un vrai navigateur.',
  tests: 'Les tests automatisés du projet.',
  docs: 'La documentation du projet.',
  scripts: 'Les scripts d’installation, de build ou de maintenance du projet.',
  '.github': 'Les workflows d’intégration continue (CI) du dépôt.',
  generated: 'Du code produit automatiquement — jamais à modifier à la main.',
};

/** La phrase d'un dossier racine, s'il y en a une. */
export function rootFolderNote(name: string): string | undefined {
  return ROOT_FOLDER_NOTES[name];
}
