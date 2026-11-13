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
