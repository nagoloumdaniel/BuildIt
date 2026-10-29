# Politique de sécurité

BuildIt est en **pré-alpha** : aucune version n'est officiellement supportée, et seule la branche `main` reçoit des correctifs.

## Signaler une vulnérabilité

Ne publiez **pas** de faille dans une issue publique. Utilisez le signalement privé de GitHub : onglet **Security** du dépôt, puis **Report a vulnerability** ([lien direct](https://github.com/nagoloumdaniel/BuildIt/security/advisories/new)).

Indiquez, si possible : le composant concerné (CLI `pf`, configurateur web, générateur, registre), les étapes de reproduction, l'impact estimé et la version ou le commit.

C'est un projet personnel : aucun délai de réponse n'est garanti, mais chaque signalement sera lu.

## Périmètre

- Le CLI `pf`, le configurateur web (`apps/web`, servi en local sur `127.0.0.1`) et les paquets du moteur.
- Le code généré **n'est pas couvert** une fois produit : il appartient à son auteur.

## Points d'attention connus

- Le jeton GitHub est stocké dans le trousseau du système et ne doit jamais apparaître dans le dépôt (secretlint tourne au `pre-commit` et dans `pnpm ci:local`).
- Ne mettez jamais de clé API ou de secret dans une issue, une PR ou un manifest partagé.
