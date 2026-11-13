# Changelog

Format : [Conventional Commits](https://www.conventionalcommits.org/fr/), généré avec `git cliff -o CHANGELOG.md`.

## Non publié

### Lot 0 : socle

- Scaffolding du plugin (`.claude-plugin/`, `hooks/hooks.json`), Biome, `tsc --checkJs`, CI GitHub Actions
- `getOutputTokens()` : cascade payload → transcript → estimation, source réelle vérifiée (`docs/token-source.md`)
- RNG injectable avec seed, `config.js`, stub du host pour les tests
