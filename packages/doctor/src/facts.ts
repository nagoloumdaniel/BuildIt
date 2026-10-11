/**
 * Project Doctor (§16) : le diagnostic d'un projet, **sans toucher au disque**.
 *
 * Le module ne connaît ni `fs`, ni le réseau, ni le terminal : il reçoit des
 * faits déjà lus (le CLI s'en charge) et rend un rapport. C'est ce qui rend le
 * score vérifiable par un test, et ce qui empêche le Doctor de devenir un
 * deuxième moteur caché : il ne décide de rien, il constate et propose.
 *
 * Les catégories de constats sont celles du §16 : TypeScript, dépendances,
 * variables d'environnement, base de données, Docker, tests, CI, monitoring,
 * rate limiting. Le score est la part des constats satisfaits — un constat
 * partiel compte la moitié —, donc toujours entre 0 et 100.
 */

/** Ce qu'un constat dit du projet. */
export type CheckStatus = 'pass' | 'warn' | 'fail' | 'n/a';

/** Une correction automatique possible, à proposer avant de l'appliquer. */
export interface Fix {
  /** Le fichier créé ou modifié, relatif à la racine du projet. */
  readonly path: string;
  /**
   * `create` n'écrase jamais rien ; `merge-json` **ajoute** des clés à un JSON
   * existant (les clés déjà là ne sont pas touchées). Il n'existe pas d'action
   * qui remplace un fichier : le Doctor propose, il ne réécrit pas le travail
   * de quelqu'un d'autre.
   */
  readonly action: 'create' | 'merge-json';
  /** Le contenu créé, ou l'objet JSON à fusionner, sérialisé. */
  readonly content: string;
  /** Pourquoi cette correction, en une phrase. */
  readonly reason: string;
}

export interface Check {
  /** Identifiant stable : c'est lui que citent les tests et la documentation. */
  readonly id: string;
  readonly title: string;
  readonly status: CheckStatus;
  /** Ce qui est constaté, en français lisible. */
  readonly detail: string;
  /** Absent quand le constat est sans objet ou déjà satisfait. */
  readonly fix?: Fix | undefined;
}

export interface Report {
  /** 0 à 100 : la part des constats satisfaits, arrondie. */
  readonly score: number;
  readonly checks: readonly Check[];
  /** Les constats qui comptent : ni `pass`, ni `n/a`. */
  readonly open: readonly Check[];
}

/** Ce que le Doctor doit savoir d'un projet pour le diagnostiquer. */
export interface ProjectFacts {
  /** Le nom du projet tel qu'il s'affiche. */
  readonly name: string;
  /** Les dépendances du manifest (`dependencies` + `devDependencies`). */
  readonly dependencies: readonly string[];
  /** Les scripts déclarés dans `package.json`. */
  readonly scripts: readonly string[];
  /** Le projet applique TypeScript : `tsconfig.json` présent, ou `typescript` en dépendance. */
  readonly typescript: boolean;
  /** Un gestionnaire de paquets est identifiable (verrou ou `packageManager`). */
  readonly packageManager: boolean;
  /** Le dossier du gestionnaire de paquets : `node_modules`, `.venv`… */
  readonly installed: boolean;
  /** `.gitignore` présent. */
  readonly gitignore: boolean;
  /** Un `Dockerfile` (ou `compose.yaml` / `docker-compose.yml`) existe. */
  readonly docker: boolean;
  /** `.dockerignore` présent — seulement évalué si `docker`. */
  readonly dockerignore: boolean;
  /** Des fichiers de test existent, ou un script de test les lance. */
  readonly tests: boolean;
  /** Un workflow `.github/workflows/*.yml` existe. */
  readonly ci: boolean;
  /** `.env.example` (ou `.env.sample`, `.env.template`) existe. */
  readonly envExample: boolean;
  /** Les noms de variables d'environnement **lués par le code**. */
  readonly envUsed: readonly string[];
  /** README présent. */
  readonly readme: boolean;
  /** Les identifiants de technologies du manifest, quand il y en a un. */
  readonly technologies: readonly string[];
  /**
   * Les paquets npm que la pile **déclare** : une entrée par fiche du manifest,
   * avec les paquets attendus du catalogue. Le Doctor ne recopie aucune liste —
   * le CLI les tient du catalogue, seule source de vérité sur ce qui existe
   * (§11).
   */
  readonly expectedPackages: readonly {
    readonly id: string;
    readonly packages: readonly string[];
  }[];
  /** Les identifiants du catalogue réellement présents dans la pile du projet. */
  readonly catalogueIds: readonly string[];
}
