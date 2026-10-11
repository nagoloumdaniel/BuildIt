# Phase 11 — Quickstart suivi de zéro par une personne extérieure

**Date :** 11/10/2026 · **Dépôt :** `D:\Projets\BuildIt`, branche `feat/phase8-web-socle`, HEAD `dab27d4`
**Machine :** Windows 11, PowerShell 5.1.26100.9549, Node `v24.10.0`, pnpm `11.13.1`
**Objet :** fermer le premier point ouvert du gate M6 — « quickstart suivi de zéro par une personne extérieure → projet généré en < 10 min » ([roadmap](../roadmap.md), ligne 710).
**Rôle tenu :** celui d'une personne qui n'a jamais vu le produit, qui suit [`docs/guide/quickstart.md`](../../guide/quickstart.md) **littéralement, dans l'ordre**, et qui note chaque friction.

## 1. Méthode

Dossier de travail **vierge et hors du dépôt** : `C:\Users\Landh\AppData\Local\Temp\pf-quickstart-7k2m4q`, contenant le clone (`BuildIt\`) et les projets écrits (`mon-projet\`, `mon-projet-install\`). Aucun fichier du dépôt de travail n'a été touché par le parcours.

Chaque segment est chronométré par un `Stopwatch` .NET autour de **la commande du guide**, exécutée telle qu'écrite. Les sorties sont comparées **programmatiquement** au bloc correspondant du guide (`Compare-Object` ligne à ligne) plutôt qu'à l'œil.

## 2. Chronomètre

| # | Segment (commande du guide) | Durée | Sortie |
|---|---|---|---|
| S1 | `git clone …` **tel qu'écrit au §1** | 1,7 s | exit 0 — mais branche `main`, **sans le guide** (voir F1) |
| S1b | `git clone --branch feat/phase8-web-socle …` | 2,0 s | exit 0, guide présent |
| S2 | `pnpm install` (dépôt) | **28,7 s** | exit 0, **store pnpm chaud** |
| S3 | `pnpm pf --help` (§2) | 6,2 s | exit 0, identique au guide |
| S4 | `pnpm pf template list` (§3) | 4,0 s | exit 0, identique au guide |
| S5 | `pnpm pf create … --dry-run` (§4) | 3,5 s | exit 0, « 34 fichiers, 18822 caractères » |
| S6 | `pnpm pf create … --no-install --no-git --yes` (§5) | 3,6 s | exit 0, 34 fichiers sur disque |
| S7 | `pnpm pf graph --preset saas` (§7) | 3,6 s | exit 0, identique au guide (22 lignes) |
| S8 | `pnpm pf create … --no-git --yes` (**installation comprise**) | **67,9 s** | exit 0, `node_modules` présent |
| S9 | §9 corrigé : les 5 commandes du mode expert | 85,3 s | exit 0 — machine chargée (voir §2.1) |

**Du dossier vide au projet généré (écriture seule) :** 2,0 + 28,7 + 3,6 = **34,3 s**.
**Du dossier vide au projet généré *et installé* :** 2,0 + 28,7 + 67,9 = **98,6 s**.
Même en ajoutant les trois commandes d'exploration du guide (`--help`, `template list`, `--dry-run`) : **≈ 2 min**.

### 2.1 Ce qui est chronométré, et ce qui ne l'est pas

- **Chronométré :** le clone, l'installation du dépôt, et **l'installation des dépendances du projet généré** (S8, `pf create` sans `--no-install`) — c'est la définition la plus exigeante de « installation comprise ».
- **Non chronométré, et c'est la réserve principale :** le **store pnpm était déjà chaud** sur cette machine. Toutes les dépendances étaient en cache local ; les deux installations n'ont rien téléchargé. Sur une machine neuve, elles téléchargent — le seuil des 10 min dépend alors du réseau, pas du produit.
- **Non exécuté :** `pnpm dev` (serveur au premier plan), `pnpm build` + `pnpm pf web` (§8 : `next build` est mené en parallèle par un autre chantier de cette session), Docker, et l'installation du dépôt **à froid**.
- **Variance :** les mesures sont prises sur une machine partagée avec d'autres processus. Les invocations `pf` ont varié de **3,5 s** (S5, machine calme) à **≈ 17 s** (S9, machine chargée) pour un travail identique. Les durées des segments courts sont donc indicatives à ±10 s.

## 3. Le parcours, friction par friction

### F1 — `git clone` ne donne pas le guide (bloquant, corrigé)

Le §1 donnait `git clone https://github.com/nagoloumdaniel/BuildIt.git`. Exécuté tel quel, le clone rend la branche par défaut **`main`**, dans laquelle :

```text
git cat-file -e origin/main:docs/guide/quickstart.md   → échec (absent)
git cat-file -e origin/main:docs/guide/README.md       → échec (absent)
git cat-file -e origin/main:apps/web/src/app/page.tsx  → échec (absent)
git cat-file -e origin/main:apps/cli/src/commands/share.ts → échec (absent)
git rev-list --count origin/main..feat/phase8-web-socle → 17
```

Une personne extérieure qui suit le guide littéralement ne peut donc **pas lire le guide après avoir cloné**, et n'obtient ni `apps/web`, ni `pf share`. C'est le seul point qui empêche réellement le parcours d'aboutir.
**Corrigé :** le §1 clone désormais `--branch feat/phase8-web-socle`, avec la raison et les deux commandes de vérification.

### F2 — Le §9 ne fonctionne pas sous PowerShell (bloquant, corrigé)

Le §9 écrit `pnpm pf template show api --name mon-api > pf.manifest.json`. Sous PowerShell 5.1 — le shell que le guide déclare lui-même en tête — `>` réencode en **UTF-16LE** :

```text
octets du fichier : FF FE 7B 00
pf add stripe --manifest pf.manifest.json --yes
✗ « …\pf.manifest.json » n'est pas du JSON valide : Unexpected token '�', "��{ …"
[ELIFECYCLE] Command failed with exit code 1.
```

Le correctif « naturel » (`Set-Content -Encoding utf8`) **ne marche pas non plus** : PowerShell 5.1 y ajoute un BOM, et le CLI le refuse (`Unexpected token ''`, octets `EF BB BF`).
**Corrigé :** le guide donne la forme qui marche et l'a vérifiée — laisser `cmd` rediriger les octets bruts : `cmd /c "pnpm pf template show api --name mon-api > <dossier>\pf.manifest.json"` (octets `7B 0A 20` ; les quatre commandes suivantes passent).

> Observation transmise au lead (pas un correctif de ma part, `apps/cli/**` interdit) : le CLI refuse un manifest UTF-8 **avec BOM**. C'est défendable au sens de la RFC 8259, mais c'est le fichier que produit la commande la plus évidente de PowerShell — un `readFileSync` qui retire un BOM de tête coûterait une ligne.

### F3 — `/tmp/...` n'est pas portable sous Windows (moyen, corrigé)

Le guide écrit « les chemins absolus ont été rendus portables (`/tmp/…`) ». Sous Windows, `/tmp/mon-projet` **vise `C:\tmp\mon-projet`**, et le CLI l'affiche relativement au dossier courant :

```text
--dir /tmp/pf-proof   → Aperçu — rien n'est écrit. 34 fichiers dans ..\..\..\..\..\..\..\tmp\pf-proof/ :
--dir C:\tmp\pf-proof → Aperçu — rien n'est écrit. 34 fichiers dans ..\..\..\..\..\..\..\tmp\pf-proof/ :
identiques ? True
```

Deux chemins différents affichent le même dossier : les sorties recopiées au guide (« dans `/tmp/mon-projet/` ») ne peuvent donc **jamais** correspondre à ce que voit le lecteur.
**Corrigé :** convention `<dossier>` (dossier de travail hors du dépôt), définition explicite au §0 avec sa variante bash et PowerShell, et avertissement sur `/tmp` sous Windows.

### F4 — Les sorties ne sont pas recopiées « telles quelles » (mineur, mais systématique, corrigé)

Le guide annonçait des sorties recopiées telles quelles. En réalité, **chaque** invocation commence par une ligne de pnpm absente de tous les blocs :

```text
$ jiti apps/cli/src/main.ts "--help"
```

et chaque échec se termine par `[ELIFECYCLE] Command failed with exit code 1.`. Ces lignes appartiennent à pnpm, pas à `pf` : elles ne sont pas fausses, mais l'affirmation « recopiées telles quelles » l'était.
**Corrigé :** une section « conventions de transcription » en tête du guide dit exactement ce qui est retiré et pourquoi.

### F5 — Le §10 fusionnait deux lignes (mineur, corrigé)

Le tableau des codes de sortie donnait `✗ Le champ « type » n'existe pas dans un manifest. (MANIFEST_UNKNOWN_FIELD)` sur une ligne. La sortie réelle est :

```text
✗ Le champ « type » n'existe pas dans un manifest. Vérifiez l'orthographe.
  (MANIFEST_UNKNOWN_FIELD)
```

**Corrigé :** le tableau dit désormais que le code est sur la ligne suivante, et cite la phrase complète.

### F6 — Le §8 est un cul-de-sac sans `pnpm build` (mineur, complété)

Le §8 enchaîne `pnpm build` puis `pnpm pf web`, en notant seulement après coup que rien n'a été exécuté. Vérifié sur un clone **non construit**, `pf web` refuse proprement :

```text
✗ Le configurateur n’est pas construit : apps\web\.next\BUILD_ID est absent.
  → Lancez « pnpm build » depuis la racine du dépôt, puis relancez pf web.
```

et le bloc `Usage` du guide est bien la sortie réelle de `pnpm pf web --help`.
**Complété :** le garde-fou est cité dans le guide, et la raison de la non-exécution (`next build` en cours dans un autre chantier) est écrite.

### F7 — Le CLI change sous le guide (moyen, signalé, non corrigeable ici)

Pendant ce parcours, le **working tree** a gagné `pf doctor` (16 commandes, `PENDING` réduit à `analyze, upgrade`), alors que la révision commitée — celle que clone le lecteur — en compte **15** avec `PENDING = doctor, analyze, upgrade`. La sortie `--help` recopiée au §2 et l'exemple de code de sortie `2` du §10 (`pf doctor` → « n'est pas encore disponible ») deviendront faux dès que ce travail sera commité.
**Signalé au lead.** Le CLI est hors de mon périmètre d'écriture ; le guide documente la révision commitée, ce qui est la bonne référence pour un lecteur qui clone aujourd'hui.

### Ce qui n'était pas une friction

Les sorties recopiées dans le guide ont été **comparées ligne à ligne** au bloc du document et sont exactes : `--help` (§2), `template list` (§3), `graph --preset saas` (§7, 22 lignes), `pf web --help` (§8), le décompte `34 fichiers, 18822 caractères` du `--dry-run` (§4), les sorties du §9, les deux refus pédagogiques (`pf add drizzle` sans base, faute de frappe `betterauth`), et les codes de sortie `0` / `1` / `2`. Le guide était honnête : ses défauts étaient des **impasses d'exécution**, pas des chiffres inventés.

## 4. Verdict sur le seuil de 10 minutes

**Atteint, et largement.** Du dossier vide à un projet **généré et installé** : **98,6 s** (≈ 1 min 40). En n'important que la génération (écriture seule) : **34,3 s**.

Deux réserves, écrites pour qu'on ne s'appuie pas sur ce chiffre au-delà de ce qu'il prouve :

1. **store pnpm chaud.** Les 28,7 s et les 67,9 s ne contiennent aucun téléchargement. À froid, ils dépendent entièrement du réseau. Le seuil reste néanmoins atteignable à froid : 10 min pour cloner ~1 Mo et installer deux fois, c'est du ressort d'une connexion normale, pas d'une performance produit.
2. **Le seuil porte sur la machine du lecteur, pas sur le produit.** La part réellement attribuable à Project Factory — le clone, `pnpm install`, puis `pf create` — est de quelques secondes hors réseau ; c'est l'écosystème JavaScript qui coûte le reste.

## 5. Corrections apportées au guide

Dans [`docs/guide/quickstart.md`](../../guide/quickstart.md) (475 lignes après correction) :

- **§ nouveau « Combien de temps ? »** (ligne 17) : le chronomètre ci-dessus, avec sa réserve sur le store chaud ;
- **§0** : « Comment invoquer `pf` » (ligne 45) — `pnpm pf …` depuis la racine du dépôt, et la forme publiée **annoncée comme non disponible** (Phase 12) ; « Où travailler » (ligne 58) — le dossier de travail hors du dépôt et le piège de `/tmp` sous Windows ;
- **§1** (ligne 79) : clone de la branche, avec la preuve que `main` ne convient pas ; le bloc « **non exécutées ici** » remplacé par la mesure réelle ;
- **§5** : la durée de la génération **avec** installation (68 s) ;
- **§6** : `pnpm install` inutile quand `pf create` l'a fait, `pnpm dev` explicitement non lancé ;
- **§8** : sortie réelle du garde-fou de `pf web` ;
- **§9** (ligne 388) : les chemins en `<dossier>`, et le correctif PowerShell de la redirection, BOM inclus ;
- **§10** : le code d'erreur sur sa propre ligne ;
- **en-tête** : les deux conventions de transcription.

## 6. Ce qui reste ouvert

- **F7** : régénérer la sortie `--help` du §2 et l'exemple `pf doctor` du §10 quand `pf doctor` sera commité (travail d'un autre chantier, en cours).
- **BOM** : décision produit à prendre (tolérer un BOM de tête dans un manifest ?) — signalée au lead.
- **Non rejoué** : le clone et l'installation **à froid**, `pnpm dev`, et `pnpm build` + `pnpm pf web`. Le parcours le plus exigeant qui ait été chronométré va du dossier vide au projet installé, mais **pas** jusqu'au serveur de développement qui tourne.
