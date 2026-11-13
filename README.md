# Tokemon

Mod Claude Code (onglet Code de Claude Desktop et terminal) : un compagnon Pokémon pixel art vit
au-dessus du prompt et gagne de l'XP avec les **output tokens** que Claude produit. Des Pokémon
sauvages apparaissent au fil du travail, on les capture avec des Balls, des items tombent, les mons
évoluent. Pas de combats en V1.

> Usage strictement personnel, dépôt privé : les sprites sont des assets Nintendo. Voir [Crédits](#crédits).

## Ce que fait le mod

- Démarre tout seul à chaque session ; au premier lancement, propose un starter (Bulbizarre, Salamèche, Carapuce, Pikachu)
- XP = output tokens **réels** du tour (boucle principale et subagents), niveaux 1 à 100 (niveau n = n³ XP)
- Évolutions : par niveau (annulable), par pierre, par Link Cable, au choix pour Évoli
- Rencontres sauvages toutes les 5 000 tokens (35 %), 5 raretés, shiny à 1/512, capture avec 4 Balls
- Drops toutes les 2 000 tokens (15 %) : Balls, pierres, bonbons, baies, boosts temporaires
- Pokédex, 20 succès avec récompenses, tableau de bord (tokens par jour, captures, journal)
- Bande animée au-dessus du prompt, panneau latéral à 5 onglets, toasts, commande `/tokemon`
- Gen 1 embarquée (153 sprites), gens 2 à 5 téléchargeables à la demande

## Installation locale

Prérequis : Claude Code ≥ 2.1.287 (testé sur 2.1.323), et les modules de hooks activés sur ton compte
(voir [Dépannage](#dépannage)).

### Option A : marketplace locale (recommandée, vaut aussi pour l'onglet Code de Claude Desktop)

Depuis un terminal, à faire une fois :

```bash
git clone git@github.com:seishiiinsan/tokemon.git ~/dev/tokemon
```

```bash
claude plugin marketplace add ~/dev/tokemon
```

```bash
claude plugin install tokemon@tokemon-local --scope user
```

Un plugin installé au scope `user` depuis un terminal se charge aussi dans les sessions locales de
l'onglet Code de Claude Desktop, où `/plugin` n'existe pas. Comme la marketplace est un dossier, le mod
est lu **directement depuis ce dossier** : après un `git pull`, `/reload-plugins` suffit (ou une nouvelle session).

### Option B : sans installation, pour développer

```bash
claude --plugin-dir ~/dev/tokemon
```

Pour l'onglet Code de Claude Desktop (pas de flag possible), ajoute dans `~/.claude/settings.json` :

```json
{ "env": { "CLAUDE_CODE_PLUGIN_DIRS": "/chemin/absolu/vers/tokemon" } }
```

### Vérifier que ça marche

1. Ouvre une session : un toast propose le starter, la bande affiche « choisis ton starter ».
2. `/tokemon start pikachu`, puis envoie un prompt : l'XP monte du nombre d'output tokens du tour.
3. `/tokemon pane` ouvre le panneau.

## Commandes

| Commande | Effet |
|---|---|
| `/tokemon` | Résumé : mon actif, niveau, XP, boosts |
| `/tokemon start <mon>` | Choisir le starter (premier lancement seulement) |
| `/tokemon switch <mon>` | Changer de mon actif (nom, surnom ou `#numéro` de la box) |
| `/tokemon box` · `/tokemon bag` | Mons capturés · inventaire |
| `/tokemon use <item> [mon]` | Utiliser un item (pierre, Link Cable, bonbon, baie, boost) |
| `/tokemon evolve [forme]` · `/tokemon stop` | Évoluer (forme à préciser pour Évoli) · annuler l'évolution en cours |
| `/tokemon catch [ball]` | Lancer une Ball (`poke`, `super`, `hyper`, `master`) |
| `/tokemon dex [mon]` · `/tokemon achievements` · `/tokemon stats` | Pokédex · succès · tableau de bord |
| `/tokemon pane [onglet]` | Ouvrir/fermer le panneau (`équipe`, `sac`, `dex`, `succès`, `stats`) |
| `/tokemon nick <nom>` | Surnom du mon actif |
| `/tokemon shiny` · `/tokemon default` | Variante affichée d'un mon shiny |
| `/tokemon download <gen2..gen5>` | Télécharger les sprites d'une génération |
| `/tokemon help` | Aide |
| `/tokemon debug <action> …` | Triche de dev, seulement avec `TOKEMON_DEBUG=1` |

Debug (`TOKEMON_DEBUG=1 claude …`) : `xp <n>`, `encounter [mon] [shiny]`, `drop [item]`, `item <item> [n]`, `tokens`.

## Sprites des gens 2 à 5

Deux façons, même cache (`~/.claude/tokemon/sprites/genN.json`) :

- **Dans Claude** : `/tokemon download gen2`. L'API GitHub anonyme est limitée à 60 requêtes par heure :
  la commande télécharge un lot de 14 Pokémon et reprend où elle s'est arrêtée. Une génération complète
  demande donc plusieurs lots étalés dans le temps.
- **D'un coup, depuis le dépôt** (clone git partiel, sans limite) :

```bash
node scripts/fetch-gen.mjs gen2 gen3 gen4 gen5
```

Les mons non téléchargés n'apparaissent pas dans les rencontres. La gen 5 est incomplète en amont
(69 dossiers, sans variante shiny).

## Équilibrage

Toutes les constantes sont dans [`hooks/config.js`](hooks/config.js), les règles et les choix
d'interprétation du cahier des charges dans [`docs/balancing.md`](docs/balancing.md).

## Développement

```bash
npm ci
```

```bash
npm run check
```

`npm run check` enchaîne Biome, `tsc --noEmit --checkJs`, les tests (`node:test`, couverture de
`hooks/core/` ≥ 80 %) et `scripts/check-data.mjs`. Aucun build : les fichiers chargés par Claude Code
sont les sources.

| Script | Rôle |
|---|---|
| `npm run preview` | Rend la bande et le panneau dans le terminal via le faux hôte, sans Claude |
| `npm run build:frames` | Recompile `hooks/data/frames.gen1.js` à partir de `sprites/` |
| `npm run build:data` | Régénère espèces et évolutions (`@pkmn/dex`, `pokemon`) |
| `claude plugin validate .` | Validation par le moteur lui-même |

Documentation : [`docs/architecture.md`](docs/architecture.md), [`docs/token-source.md`](docs/token-source.md),
[`docs/balancing.md`](docs/balancing.md), [`docs/CDC.md`](docs/CDC.md), [`CHANGELOG.md`](CHANGELOG.md).

## Dépannage

- **Rien ne s'affiche, `/tokemon` inconnu** : lance `claude --debug` et cherche `tokemon`. Le message
  `hooks modules are turned off for installed plugins in this process` signifie que les modules de hooks
  ne sont pas (encore) activés pour ce processus : ils sont derrière un flag de déploiement côté Anthropic.
- **`hooks module did not load`** : erreur de chargement du mod, le message qui suit dit laquelle.
- **Bande sans sprite** : fenêtre trop étroite (moins de 42 colonnes utiles) ou bande trop basse : le texte reste affiché.
- **Repartir de zéro** : supprime les clés `tokemon:v1:*` du store du plugin (`~/.claude/plugins/store/tokemon*.json`).

## Crédits

- Sprites : [jakobhoeg/vscode-pokemon](https://github.com/jakobhoeg/vscode-pokemon), via
  [dgokcin/claude-pokemon-mod](https://github.com/dgokcin/claude-pokemon-mod), qui a aussi servi de référence
  pour l'API des mods. Le code de Tokemon est écrit from scratch.
- Données : [@pkmn/dex](https://github.com/pkmn/ps) (Pokémon Showdown, MIT), [pokemon](https://github.com/sindresorhus/pokemon) (noms FR, MIT).
- Pokémon © Nintendo / Creatures Inc. / GAME FREAK inc. Usage personnel non commercial. Détail : [`sprites/CREDITS.md`](sprites/CREDITS.md).
