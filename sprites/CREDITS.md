# Crédits des sprites et des données

## Sprites

- Les GIF de ce dossier (génération 1 : `default|shiny` × `idle|walk`, 8 fps) sont copiés de
  [dgokcin/claude-pokemon-mod](https://github.com/dgokcin/claude-pokemon-mod) (dossier `sprites/`).
- Ils proviennent à l'origine de [jakobhoeg/vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon)
  (dossier `media/gen1`). Les générations 2 à 5 sont téléchargées à la demande depuis ce même dépôt
  (`media/gen2` à `media/gen5`) et ne sont pas redistribuées ici.
- Pokémon et tous les noms et images associés sont © Nintendo / Creatures Inc. / GAME FREAK inc. /
  The Pokémon Company.

**Usage strictement personnel et non commercial.** Ce dépôt reste privé : les sprites sont des
assets Nintendo et le dépôt de référence n'a pas de licence.

## Données de jeu

- Niveaux et méthodes d'évolution : données officielles, générées par `scripts/build-data.mjs` à partir de
  [@pkmn/dex](https://github.com/pkmn/ps) (données Pokémon Showdown, MIT) et recoupées pour la génération 1
  avec `hooks/evolutions.js` de dgokcin/claude-pokemon-mod.
- Noms français : paquet npm [pokemon](https://github.com/sindresorhus/pokemon) (MIT).

## Code

Le code de Tokemon est écrit from scratch. dgokcin/claude-pokemon-mod a servi de référence pour
comprendre l'API des mods de Claude Code (bande, panneau, store, commandes, événements) ; aucun de
ses modules n'est copié.
