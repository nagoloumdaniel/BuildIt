# Assets de marque

Sources de la marque Project Factory. Rien ici n'est encore utilisé par du code : la direction artistique se décide en Phase 8A de la [roadmap](../../docs/roadmap.md).

## Nommage

Les fichiers sont nommés d'après **le fond sur lequel ils se posent**, pas d'après leur propre couleur :

| Fichier | À utiliser sur | Couleur dominante |
|---|---|---|
| `logo-on-light.png` | thème clair | sombre |
| `logo-on-dark.png` | thème sombre | clair |

C'est la convention la moins ambiguë : à l'usage on écrit `prefers-color-scheme: dark → logo-on-dark`, sans avoir à se rappeler quelle couleur va avec quel thème.

## État : provisoire

Ces fichiers sont des **PNG matriciels de 550×453**. Avant toute utilisation en production, trois points sont à traiter :

1. **Vectoriser.** Un logo doit être en SVG : net à toute taille, recolorable par CSS, quelques kilooctets au lieu de 170. En 550 px de large, ces PNG sont déjà flous sur un écran retina à partir de 275 px d'affichage.
2. **Décider si deux fichiers sont nécessaires.** Un SVG monochrome avec `fill="currentColor"` couvre les deux thèmes avec un seul fichier — et suit automatiquement un thème personnalisé, ce que deux PNG figés ne feront jamais.
3. **Dériver les formats dédiés** : favicon (16/32/180 px), icône sociale Open Graph (1200×630), icône carrée pour le registre npm.

## Direction artistique — à trancher en Phase 8A

Observation à verser au débat, pas une décision : un dossier de documents en rendu 3D brillant évoque un gestionnaire de fichiers. Or le produit n'organise pas des fichiers, il **compose des projets** — et son argument différenciant (§25) est précisément de ne pas être un scaffolder générique de plus. Un dossier est aussi un motif très courant dans les banques d'icônes, ce qui joue contre la mémorisation.

À confronter aux skills `frontend-design` et `taste-skill` au moment de la Phase 8A, avec les alternatives : un motif d'assemblage ou de composition, un motif de forge/moteur (cohérent avec le nom du moteur), ou un logotype purement typographique.
