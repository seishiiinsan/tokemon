# Changelog

Format : [Conventional Commits](https://www.conventionalcommits.org/fr/), généré avec `git cliff -o CHANGELOG.md`.

## Non publié

### Lot 0 : socle

- Scaffolding du plugin (`.claude-plugin/`, `hooks/hooks.json`), Biome, `tsc --checkJs`, CI GitHub Actions
- `getOutputTokens()` : cascade payload → transcript → estimation, source réelle vérifiée (`docs/token-source.md`)
- RNG injectable avec seed, `config.js`, stub du host pour les tests

### Lot 1 : compagnon

- Sprites gen 1 embarqués (`sprites/`, `CREDITS.md`) et compilés par `scripts/build-frames.mjs` (décodeur GIF maison, sans ffmpeg)
- Bande au-dessus du prompt : scène animée 8 fps (Raster + blit en terminal, Svg sur desktop), repli texte
- Starter au premier lancement, démarrage automatique, XP par output token, niveaux 1 à 100 (n³)
- `/tokemon`, `start`, `switch`, `box`, `nick`, `shiny`, `default`, `help`
- Persistance `$.store` versionnée, migrations, transactions avec relecture (sessions concurrentes), déduplication des tours
- Données : 634 espèces (gens 1 à 5), évolutions, raretés, items, succès ; `scripts/check-data.mjs`

### Lot 2 : évolutions

- Évolution par niveau : annoncée (toast, flash blanc), appliquée après 15 s, annulable avec `/tokemon stop`, relançable avec `/tokemon evolve`
- Évolution par pierre et par échange (Link Cable) via `/tokemon use <item> [mon]`
- Évoli et espèces à plusieurs branches : `/tokemon evolve <forme>`, formes des gens 2+ dès que leurs sprites sont en local
- Méthodes absentes de la V1 (bonheur, lieu…) repliées sur un niveau configurable
- `/tokemon debug xp|item|tokens` (TOKEMON_DEBUG=1)

### Lot 3 : rencontres et capture

- Rencontres sauvages : un tirage à 35 % tous les 5 000 output tokens (×2 sous Encens), pool limité aux sprites en local
- 5 raretés (listes éditables dans `data/rarity.js`), formes évoluées plus rares (÷3, ÷9), shiny à 1/512
- `/tokemon catch [ball]` : taux de base × multiplicateur de la Ball, Master Ball garantie ; fuite après 10 min ou 3 échecs
- Mon sauvage dans la bande, animation de Ball, toasts de rencontre, capture, échec et fuite
- Pokédex vus / capturés / shiny, `/tokemon dex [mon]`, `/tokemon debug encounter [mon] [shiny]`
