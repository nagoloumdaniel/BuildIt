# Assets de marque

Sources de la marque BuildIt. Elles sont **utilisées par l'application web** : le logo de
l'en‑tête suit le thème actif, sans JavaScript et sans clignotement.

## Nommage

Les fichiers sont nommés d'après **le fond sur lequel ils se posent**, pas d'après leur propre
couleur :

| Fichier | À utiliser sur | Couleur dominante |
|---|---|---|
| `logo-on-light.png` / `.webp` | thème clair | sombre |
| `logo-on-dark.png` / `.webp` | thème sombre | clair |

C'est la convention la moins ambiguë : à l'usage on écrit
`prefers-color-scheme: dark → logo-on-dark`, sans avoir à se rappeler quelle couleur va avec quel
thème.

## Ce qui est servi

Le navigateur ne télécharge **que le fichier du thème affiché** : `apps/web/src/app/globals.css`
déclare `--pf-logo-image` en clair, et le bloc `[data-theme="dark"]` le remplace. Le logo est une
image de fond (`.pf-logo-mark`), pas un `<img>` — donc une seule requête, et la bascule de thème
est la même règle CSS que celle des couleurs (aucun état React, aucun flash).

Les **WebP** sont ce qui part en production (`apps/web/public/brand/`) : 18 ko au lieu de 170 ko.
Ils sont engendrés depuis les PNG par `apps/web/scripts/build-brand-webp.py` — relancer le script
après avoir remplacé un PNG.

## État : provisoire

Ces fichiers sont des **PNG matriciels de 550 × 453** (les WebP en dérivent). Trois points restent à
traiter, inchangés :

1. **Vectoriser.** Un logo doit être en SVG : net à toute taille, recolorable par CSS, quelques
   kilooctets au lieu de 170. En 550 px de large, ces PNG sont déjà flous sur un écran retina à
   partir de 275 px d'affichage.
2. **Décider si deux fichiers sont nécessaires.** Un SVG monochrome avec `fill="currentColor"`
   couvrirait les deux thèmes avec un seul fichier — et suivrait un thème personnalisé, ce que deux
   fichiers figés ne feront jamais.
3. **Dériver les formats dédiés.** Le favicon, l'icône d'application et l'image Open Graph sont en
   place dans `apps/web/public/` (`favicon.ico`, `icon.png`, `apple-icon.png`, `og-image.png`),
   mais dérivés à la main : à automatiser.

## Direction artistique

La direction retenue pour la Phase 8A est celle de la « Forge » : orange pour l'action et la
chaleur, acier (bleu pétrole) pour l'information refroidie, Inter pour la prose et JetBrains Mono
pour la donnée. Elle est écrite en tête de `apps/web/src/app/globals.css` et vaut pour tout le
produit.
