# Phase 8A — Direction artistique du configurateur

**Date :** 11/10/2026
**Périmètre :** tokens, règles visuelles et garde-fous des 18 écrans du MVP.
**Statut :** direction **appliquée et outillée** ; la validation humaine du gate 8A (trois maquettes arbitrées par Daniel) reste due — voir « Ce qui reste à un humain ».

---

## La direction

BuildIt est un **outil de développeur**, pas un SaaS marketing. Ce que ça change concrètement :

- **Dense plutôt qu'aéré.** 15 px de base, pas 18. Des blocs rapprochés, des listes longues lisibles. L'utilisateur est devant un écran de configuration, pas devant une page de vente.
- **Un seul accent.** Une braise (`#b4530a` en clair, `#ff9a45` en sombre) réservée à la sélection et à l'action principale. Le reste est neutre : la couleur ne sert qu'à porter un état (choisi, ajouté, bloqué, en erreur), jamais à décorer.
- **Des angles courts.** 6 px de rayon. Une ombre discrète pour détacher une carte, jamais pour faire joli.
- **Du monospace là où c'est technique.** Noms de variables, chemins de fichiers, identifiants de technologies : `--pf-mono`. Ce qui se recopie doit se distinguer au premier regard.
- **Deux thèmes, imposés par le §6.** Ils ne sont pas une variante : ils sont une exigence. Le thème est posé avant le premier rendu (script inline), donc aucun flash.

## Les tokens

Tout vit dans `apps/web/src/app/globals.css`, et **nulle part ailleurs** :

- surfaces et texte : `--pf-bg`, `--pf-surface`, `--pf-surface-2`, `--pf-text`, `--pf-muted` ;
- états : `--pf-accent` (+ `--pf-accent-soft`), `--pf-ok`, `--pf-warn`, `--pf-danger`, chacune avec sa variante `*-soft` ;
- focus : `--pf-focus`, utilisé par un `:focus-visible` global ;
- formes : `--pf-radius`, `--pf-shadow`, `--pf-mono`.

Le bloc `@theme inline` les expose à Tailwind : les utilitaires engendrés pointent sur les variables, donc basculer `data-theme` change tout sans reconstruire le CSS.

Les composants d'interface sont des classes `pf-*` (`pf-card`, `pf-choice`, `pf-grid`, `pf-btn`, `pf-badge`, `pf-hint`, `pf-input`, `pf-label`, `pf-mono`, `pf-fade-in`, `pf-sr-only-focusable`). Un écran qui a besoin d'un style de plus **le propose ici**, il ne l'invente pas dans son `.tsx`.

## Les règles, tenues par relecture et par le code

1. **Aucune couleur en dur dans un composant.** Une seule valeur écrite dans un `.tsx` et le thème sombre devient une chasse au trésor.
2. **Tout élément interactif a un `:focus-visible` visible.** C'est un outil ; on y travaille au clavier. Le gate M5 exige le parcours complet au clavier seul.
3. **`prefers-reduced-motion` est respecté globalement** (§8E) : les animations tombent à 0,01 ms, et aucune animation ne porte d'information — la progression d'une génération est aussi écrite en texte.
4. **La couleur ne porte jamais seule une information.** Un choix sélectionné est `aria-pressed="true"` **et** coloré ; une option bloquée est `disabled` **avec sa raison**.
5. **Aucune dépendance d'interface.** Pas de bibliothèque de composants, pas de CSS-in-JS, pas de police téléchargée. Tailwind 4 et les tokens suffisent : ce dépôt doit rester installable et rapide.

## Ce qui a été écarté

- **Une police de marque.** Le sujet a été considéré (8A.3) et refusé pour le MVP : un fichier de police à charger et à licencier ne vaut pas le gain, la pile système est déjà excellente sur les trois OS.
- **Un thème pastel ou un dégradé de fond.** Il ferait « template IA », exactement ce que 8A.2 demande d'éviter.
- **Des animations d'entrée par écran.** Elles ralentissent un parcours de 12 étapes ; seule une transition de 140 ms sur l'apparition d'un contenu est conservée (`pf-fade-in`).

## Ce qui reste à un humain

Le gate 8A demande une **validation de direction sur trois maquettes** — Stack Builder, Blueprint, File Preview — avant de figer les 18 écrans. Cette validation n'a pas eu lieu : les écrans ont été construits sur la direction ci-dessus, en tokens provisoires devenus le design system. Si Daniel tranche autrement, la reprise est bornée : `globals.css` et les classes `pf-*`, pas les écrans.
