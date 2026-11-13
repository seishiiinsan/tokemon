# Tokemon — Cahier des charges

Tokemon est un mod Claude Code, priorité à l'onglet Code de Claude Desktop, qui transforme les output tokens en progression d'un jeu de collection façon Pokémon. Repo privé `seishiiinsan/tokemon`, V1.

## 1. Contexte et objectif

Un compagnon pixel art vit au-dessus du prompt et gagne de l'XP avec les **output tokens** produits par Claude. Des Pokémon sauvages apparaissent au fil du travail, on les capture avec des Balls, et des items tombent aléatoirement (pierres d'évolution, consommables, boosts).

- **Usage** : strictement personnel. Le repo reste **privé** car les sprites sont des assets Nintendo et le repo de référence n'a pas de licence.
- **Inspiration** : [dgokcin/claude-pokemon-mod](https://github.com/dgokcin/claude-pokemon-mod). C'est la référence technique pour l'API des mods (band, pane, store, commands, events). **Le code est écrit from scratch** : on ne copie pas ses modules. On en reprend seulement les sprites et les données de jeu (niveaux et méthodes d'évolution), avec les crédits.
- **Cible** : l'onglet Code de Claude Desktop d'abord, le terminal ensuite (même code).

## 2. Périmètre

**Inclus en V1**

- Lancement automatique à chaque session, avec choix d'un starter au tout premier lancement
- XP proportionnelle aux output tokens, niveaux 1 à 100, évolutions (niveau, pierre, échange, choix d'Évoli)
- Compagnon actif, que l'on peut changer librement à tout moment
- Rencontres sauvages déclenchées par les tokens, et capture avec des Balls
- Raretés (5 paliers) et shiny
- Drops d'items aléatoires : pierres, Balls, consommables, boosts temporaires
- Pokédex, succès, dashboard de stats
- UI : panneau latéral, bande/status line, toasts, slash commands `/tokemon`
- Tous les Pokémon du repo de référence : la gen 1 est embarquée, les gens 2 à 5 sont téléchargées à la demande

**Hors périmètre V1 (V2+)** : combats, attaques et types ; besoins (faim/bonheur) ; mons d'équipe pour les subagents ; synchro multi-machines et classement en ligne.

## 3. Contraintes techniques

- **Langage** : JavaScript pur (modules ES) + **JSDoc** strict, vérifié par `tsc --noEmit --checkJs`. Pas de build : les fichiers chargés par Claude Code sont les sources.
- **Format** : plugin Claude Code (`.claude-plugin/plugin.json` + `hooks/hooks.json` → `modules: ["./register.js"]`), installable par marketplace locale ou Git.
- **API du mod** (à vérifier dans la référence, Claude Code ≥ v2.1.287) : `$.store`, `$.ui` (`invalidate`, `toast`, `open`/`close`), `$.command.register`, `$.clock`, `$.http.fetch`, `$.agent.list`, events `session.start`, `turn.start`, `turn.step`, `turn.complete`, `tool.call`, `prompt.submit`, `ui.render`, `ui.close`.
- **Qualité** : Biome, tests `node:test` ou Vitest sur un stub du host `$`, CI GitHub Actions.
- **Confidentialité** : aucune donnée ne sort de la machine. Seul le téléchargement de sprites appelle le réseau.

### Point bloquant à lever en premier : la source des output tokens

La référence donne de l'XP par tour, pas par token. L'agent doit d'abord trouver comment lire les output tokens, dans cet ordre :

1. Les champs d'usage dans les payloads de `turn.complete` ou du stream `turn.step` (logger un payload brut pour vérifier)
2. Une autre API du host qui expose l'usage de la session
3. En fallback, le transcript JSONL de la session (`~/.claude/projects/**.jsonl`, champ `message.usage.output_tokens`)
4. En dernier recours, une estimation (longueur du texte de sortie / 4), signalée comme approximative dans l'UI

Le résultat va dans `docs/token-source.md`. Tout le reste passe par une fonction unique, `getOutputTokens(turn)`.

## 4. Fonctionnalités

### 4.1 Démarrage et starter

- Sur `session.start`, on charge l'état depuis `$.store` et le compagnon actif s'affiche sans aucune action.
- Au premier lancement, un toast et le panneau proposent le starter : Bulbizarre, Salamèche, Carapuce ou Pikachu (`/tokemon start <mon>`).
- Inventaire de départ : 10 Poké Balls + 1 Super Bonbon.

### 4.2 XP et niveaux

- À chaque fin de tour (main agent et subagents) : `xp = outputTokens × XP_PER_TOKEN × multiplicateurs` (Lucky Egg, Multi Exp). L'XP va au mon actif.
- Courbe « medium fast » : XP totale pour le niveau n = n³ (niveau 50 = 125 000, niveau 100 = 1 000 000). Toutes les constantes vivent dans `config.js`.
- Une montée de niveau déclenche un toast et un saut animé.
- **Changement libre** : `/tokemon switch <mon>` met n'importe quel mon de la box en actif, à tout moment, sans objectif imposé ni pénalité. C'est l'utilisateur qui juge quand un mon est « assez maxé ».

### 4.3 Évolutions

- Par niveau : automatique au niveau requis, avec toast et flash blanc. `/tokemon stop` annule, `/tokemon evolve` relance.
- Par pierre (Feu, Eau, Foudre, Plante, Lune) : `/tokemon use <pierre>`, qui consomme la pierre.
- Par échange : avec un Link Cable (Kadabra, Machopeur, Gravalanch, Spectrum…).
- Évoli : `/tokemon evolve <aquali|voltali|pyroli>`, plus les formes des gens suivantes si leurs sprites sont téléchargés.
- Les données sont dans `data/evolutions.js`, avec crédits.

### 4.4 Rencontres et capture

- Toutes les `ENCOUNTER_EVERY = 5 000` output tokens, tirage avec `ENCOUNTER_CHANCE = 35 %` (×2 sous Encens).
- Le mon sauvage apparaît dans la bande et le panneau, avec un toast. Il s'enfuit après **10 min** ou **3 lancers ratés**.
- Le pool regroupe les mons dont les sprites sont en local. Les formes évoluées sont plus rares (poids ÷3 au stade 2, ÷9 au stade 3).
- `/tokemon catch [ball]` : probabilité = `baseRate(rareté) × ballMultiplier`, plafonnée à 100 %.

| Rareté | Poids de spawn | Taux de base |
| --- | --- | --- |
| Commun | 60 | 80 % |
| Peu commun | 25 | 60 % |
| Rare | 10 | 40 % |
| Épique | 4 | 20 % |
| Légendaire (Artikodin, Électhor, Sulfura, Mewtwo, Mew…) | 1 | 5 % |

- Multiplicateurs des Balls : Poké ×1, Super ×1,5, Hyper ×2, Master = capture garantie.
- Shiny : 1/512 par rencontre (1/170 avec le Charme Chroma). Un shiny garde sa variante `shiny_*`.
- Une capture ajoute le mon à la box (niveau aléatoire selon la rareté) et au Pokédex. Un échec montre la Ball qui s'ouvre.

### 4.5 Items et drops

Toutes les `DROP_EVERY = 2 000` output tokens, tirage avec `DROP_CHANCE = 15 %` dans une table pondérée. Une Master Ball est garantie à chaque palier de 1M tokens cumulés.

| Catégorie | Item | Poids | Effet |
| --- | --- | --- | --- |
| Balls | Poké Ball | 30 | ×1 |
| Balls | Super Ball | 12 | ×1,5 |
| Balls | Hyper Ball | 5 | ×2 |
| Balls | Master Ball | 0,2 | capture garantie |
| Pierres | Feu, Eau, Foudre, Plante, Lune | 3 chacune | évolution |
| Pierres | Link Cable | 2 | évolution par échange |
| Consommables | Super Bonbon | 6 | +1 niveau |
| Consommables | Baies (Oran, Sitrus…) | 10 | +X XP fixe |
| Consommables | Encens | 4 | rencontres ×2 pendant 30 min |
| Boosts | Lucky Egg | 3 | XP ×2 pendant 1 h |
| Boosts | Multi Exp | 2 | 25 % de l'XP partagés avec toute la box pendant 1 h |
| Boosts | Charme Chroma | 1 | shiny ×3 pendant 24 h |

Les boosts sont horodatés via `$.clock`, visibles dans le panneau avec le temps restant, et un toast signale leur expiration.

### 4.6 Pokédex et succès

- Pokédex : vus / capturés / shiny par mon, avec un taux de complétion par génération.
- Environ 20 succès en V1, par exemple : 1er mon capturé ; 10, 50 et 151 capturés ; 1er shiny ; 100k, 1M et 10M output tokens ; 1er légendaire ; 1re évolution par pierre ; un mon niveau 100 ; 7 jours d'affilée ; Master Ball utilisée. Chaque succès donne un toast et un item en récompense.

### 4.7 Dashboard de stats (dans le panneau)

- Output tokens par jour sur 30 jours (barres pixel), tokens et XP totaux
- Captures, rencontres, taux de capture, shiny, items obtenus et utilisés
- Journal des 50 derniers événements

## 5. Interface

| Surface | Contenu |
| --- | --- |
| Bande / status line (au-dessus du prompt) | Compagnon animé (idle/walk, 8 fps), nom, niveau, barre d'XP, boosts actifs, mon sauvage présent |
| Panneau latéral | Onglets Équipe/Box · Sac · Pokédex · Succès · Stats, ouvert avec `/tokemon pane`, état persisté |
| Toasts | Niveau, évolution, rencontre, capture/échec, fuite, drop, fin de boost, succès |

| Commande | Effet |
| --- | --- |
| `/tokemon` | Résumé : mon actif, niveau, XP, boosts |
| `/tokemon start <mon>` | Choisir le starter (premier lancement) |
| `/tokemon switch <mon>` | Changer de mon actif |
| `/tokemon box` · `bag` · `dex` · `achievements` · `stats` | Box, sac, Pokédex, succès, stats |
| `/tokemon use <item> [mon]` | Utiliser un item |
| `/tokemon evolve [forme]` · `stop` | Évoluer / annuler |
| `/tokemon catch [ball]` | Lancer une Ball |
| `/tokemon pane` | Ouvrir/fermer le panneau |
| `/tokemon nick <nom>` · `shiny` · `default` | Surnom, variante d'affichage |
| `/tokemon download <gen2..gen5>` | Télécharger les sprites d'une génération |
| `/tokemon help` | Aide |
| `/tokemon debug <xp\|encounter\|drop>` | Triche de dev, active seulement avec `TOKEMON_DEBUG=1` |

## 6. Données et persistance

Toute la persistance passe par `$.store`, avec des clés versionnées et un schéma JSDoc :

- `tokemon:v1:state` : `{ activeMonId, starterChosen, totals: { outputTokens, xp }, counters: { sinceEncounter, sinceDrop }, wild }`
- `tokemon:v1:box` : `{ id, species, nickname, level, xp, shiny, caughtAt, evolvedFrom? }[]`
- `tokemon:v1:bag` : `Record<ItemId, number>`
- `tokemon:v1:boosts` : `{ id, expiresAt }[]`
- `tokemon:v1:dex` : `Record<Species, { seen, caught, shiny }>`
- `tokemon:v1:achievements` : `Record<AchievementId, unlockedAt>`
- `tokemon:v1:history` : `{ date, outputTokens, xp }[]` (365 jours glissants) + les 50 derniers événements

Plusieurs sessions ouvertes partagent le store. Il faut relire avant d'écrire, fusionner les compteurs et dédupliquer le comptage d'un même tour. `migrations.js` s'exécute au démarrage.

## 7. Sprites et assets

- **Gen 1** : copier `sprites/` du repo de référence (GIF `default|shiny` × `idle|walk`, 8 fps) avec un `CREDITS.md` (dgokcin/claude-pokemon-mod, sprites originaux de jakobhoeg/vscode-pokemon, Pokémon © Nintendo/Game Freak, usage perso non commercial).
- **Gens 2 à 5** : téléchargement à la demande depuis `jakobhoeg/vscode-pokemon` (dossier `media`, API contents de GitHub), avec cache local. Les mons non téléchargés ne sortent pas en rencontre.
- **Rendu** : GIF → frames → bande et panneau. Étudier `png.js`, `frames.js` et `paint.js` de la référence pour les contraintes terminal/desktop, mais réimplémenter.

## 8. Architecture cible

`core/` est 100 % pur (RNG et horloge injectés) et porte toute la logique métier. `register.js` ne fait que router events et commandes.

```
tokemon/
├─ .claude-plugin/{plugin.json, marketplace.json}
├─ hooks/
│  ├─ hooks.json
│  ├─ register.js        # wiring events + commandes
│  ├─ config.js          # constantes d'équilibrage
│  ├─ core/              # xp, levels, evolution, encounter, capture, drops, boosts, achievements, stats, rng
│  ├─ data/              # species, evolutions, rarity, items, achievements
│  ├─ store/             # schema, repo, migrations
│  ├─ tokens/            # getOutputTokens + stratégies
│  ├─ ui/                # band, pane/*, toasts, render/(gif, frames, paint)
│  └─ commands/          # un fichier par sous-commande
├─ sprites/  CREDITS.md
├─ scripts/               # stub-host, preview-*, check-data
├─ tests/
└─ docs/                  # token-source, architecture, balancing
```

## 9. Qualité et critères d'acceptation

- Tests unitaires de `core/` avec ≥ 80 % de couverture (XP, courbe, évolutions, capture, tirages seedés, boosts, succès, migrations)
- `scripts/check-data.mjs` : chaque espèce a ses sprites, une rareté et des évolutions cohérentes
- Scripts de preview qui rendent la bande et le panneau via le stub host
- README (installation, commandes, équilibrage, crédits), Conventional Commits, CHANGELOG (git-cliff)

**Critères d'acceptation**

1. À l'ouverture d'une session dans l'onglet Code, le compagnon s'affiche sans commande ; au premier lancement, le starter est proposé.
2. Après un tour, l'XP du mon actif augmente proportionnellement aux output tokens réels (ou estimés, et signalés comme tels).
3. Au niveau requis, l'évolution se déclenche ; pierres et Link Cable fonctionnent via `/tokemon use`.
4. `debug encounter` fait apparaître un mon ; `/tokemon catch` applique les bons taux ; le mon rejoint la box et le dex.
5. Les drops alimentent le sac ; les boosts modifient XP, rencontres ou shiny pendant leur durée, puis expirent.
6. Le panneau affiche Équipe, Sac, Dex, Succès et Stats avec des données correctes.
7. Avec deux sessions ouvertes, il n'y a ni double comptage ni perte d'état.
8. La CI est verte (Biome, tsc checkJs, tests, check-data).

## 10. Risques

| Risque | Mitigation |
| --- | --- |
| Output tokens non exposés par l'API des mods | Stratégies en cascade (§3), estimation en dernier recours |
| API des mods instable ou peu documentée | Appels `$` isolés dans `register.js` et `ui/`, la référence comme guide |
| Rendu différent entre Desktop et terminal | Tester les deux, dégrader en texte si pas d'image |
| Droits sur les assets | Repo privé, usage perso, crédits |
| Scope « ultra complet » trop large pour un seul passage | Livraison par lots (§11), un commit ou une PR par lot |

## 11. Plan de livraison pour l'agent

1. **Lot 0, socle** : scaffolding, plugin.json/hooks.json, Biome, tsc checkJs, CI, stub host, `docs/token-source.md`
2. **Lot 1, compagnon** : sprites + rendu bande, starter, auto-start, XP/niveaux, switch, persistance
3. **Lot 2, évolutions** : données, niveau, pierres, échange, Évoli
4. **Lot 3, rencontres** : raretés, shiny, Balls, capture, Pokédex
5. **Lot 4, items** : drops, sac, consommables, boosts
6. **Lot 5, panneau** : onglets, dashboard stats, historique
7. **Lot 6, finition** : succès, toasts, help, README, téléchargement gens 2 à 5

Chaque lot se termine par des tests verts et une note dans `CHANGELOG.md`. En cas de doute sur une règle de jeu, prendre la valeur la plus simple, la mettre dans `config.js` et la documenter dans `docs/balancing.md`.
