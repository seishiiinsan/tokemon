# Tokemon : cahier des charges

**Mod Claude Code (onglet Code de Claude Desktop + terminal) · Repo privé `seishiiinsan/tokemon` · V1**

## 1. Contexte et objectif

Tokemon est un mod Claude Code qui transforme la consommation de tokens en progression de jeu de collection façon Pokémon. Un compagnon pixel art vit au-dessus du prompt et gagne de l'XP avec les **output tokens** produits par Claude. Des Pokémon sauvages apparaissent au fil du travail, on les capture avec des Balls, et des items tombent aléatoirement (pierres d'évolution, consommables, boosts).

- **Usage** : strictement personnel. Le repo reste **privé** car les sprites sont des assets Nintendo et le repo de référence n'a pas de licence.
- **Inspiration** : [dgokcin/claude-pokemon-mod](https://github.com/dgokcin/claude-pokemon-mod). C'est la référence technique pour l'API des mods (band, pane, store, commands, events). **Le code de Tokemon est écrit from scratch** : on n'y copie pas les modules de dgokcin. On en reprend seulement les sprites et les données de jeu (niveaux et méthodes d'évolution), avec les crédits.
- **Cible** : l'onglet Code de Claude Desktop en priorité, le terminal ensuite (même code).

## 2. Périmètre

### Inclus en V1
- Lancement automatique à chaque session, avec choix d'un starter au tout premier lancement
- XP proportionnelle aux output tokens, niveaux 1 à 100, évolutions (niveau, pierre, échange, choix d'Évoli)
- Compagnon actif, que l'on peut changer librement à tout moment
- Rencontres sauvages déclenchées par les tokens, et capture avec des Balls (taux selon la rareté et la Ball)
- Raretés (5 paliers) et shiny
- Drops d'items aléatoires : pierres, Balls, consommables, boosts temporaires
- Pokédex (vus/capturés), succès, dashboard de stats
- UI : panneau latéral, bande/status line, toasts, slash commands `/tokemon`
- Tous les Pokémon disponibles via le repo de référence : la gen 1 est embarquée, les gens 2 à 5 sont téléchargées à la demande

### Hors périmètre V1 (V2+)
- Combats, attaques, movesets et types
- Besoins du compagnon (faim/bonheur)
- Mons d'équipe pour les subagents
- Synchronisation multi-machines et classement en ligne

## 3. Contraintes techniques

- **Langage** : JavaScript pur (modules ES) + **JSDoc** strict, vérifié par `tsc --noEmit --checkJs`. Pas de build : les fichiers chargés par Claude Code sont les sources.
- **Format** : plugin Claude Code installable par marketplace locale ou Git, avec `.claude-plugin/plugin.json` + `hooks/hooks.json` → `modules: ["./register.js"]`, sur le modèle du repo de référence.
- **API du mod** (à vérifier dans la référence et la doc à jour de Claude Code ≥ v2.1.287) : `$.store` (persistance), `$.ui` (`invalidate`, `toast`, `open`/`close` pour le pane), `$.command.register`, `$.clock`, `$.http.fetch`, `$.agent.list`, events `session.start`, `turn.start`, `turn.step`, `turn.complete`, `tool.call`, `prompt.submit`, `ui.render`, `ui.close`.
- **Lint/format** : Biome. **Tests** : `node:test` ou Vitest, sans dépendance au runtime Claude (un stub du host `$`, comme `scripts/stub-host.mjs` dans la référence).
- **CI** : GitHub Actions (lint + typecheck + tests + validation des données).
- **Aucune donnée personnelle** envoyée hors de la machine. Le seul appel réseau autorisé est le téléchargement de sprites.

### ⚠️ Point bloquant à lever en premier : la source des output tokens
La référence donne de l'XP par tour, pas par token. L'agent doit d'abord établir comment récupérer les output tokens, dans cet ordre de préférence :
1. Les champs d'usage dans les payloads de `turn.complete` ou du stream `turn.step` (logger un payload brut pour vérifier)
2. Une autre API du host qui expose l'usage de la session
3. En fallback, la lecture du transcript JSONL de la session (`~/.claude/projects/**.jsonl`, champ `message.usage.output_tokens`), si le mod peut lire le FS
4. En dernier recours, une estimation (≈ longueur du texte de sortie / 4), signalée comme approximative dans l'UI

Le résultat va dans `docs/token-source.md`. Tout le reste passe par une fonction unique, `getOutputTokens(turn)`.

## 4. Fonctionnalités détaillées

### 4.1 Démarrage et starter
- Sur `session.start`, on charge l'état depuis `$.store` et on affiche le compagnon actif sans aucune action de l'utilisateur.
- Au premier lancement (pas d'état), un toast et le panneau proposent le starter : Bulbizarre, Salamèche, Carapuce ou Pikachu (`/tokemon start <mon>`).
- L'inventaire de départ contient 10 Poké Balls et 1 Super Bonbon.

### 4.2 XP et niveaux
- À chaque fin de tour du main agent : `xp = outputTokens × XP_PER_TOKEN × multiplicateurs` (Lucky Egg, Multi Exp).
- Les output tokens des subagents comptent aussi : leurs tours ajoutent de l'XP au compagnon actif.
- Courbe « medium fast » : XP totale pour le niveau n = n³ (niveau 50 = 125 000, niveau 100 = 1 000 000). Toutes les constantes vivent dans `config.js`.
- Une montée de niveau déclenche un toast et une petite animation (saut).
- **Changement libre** : `/tokemon switch <mon>` met n'importe quel mon de la box en actif, à tout moment. Il n'y a ni objectif imposé ni pénalité. L'XP n'est gagnée que par le mon actif.

### 4.3 Évolutions
- Par niveau : déclenchée automatiquement au niveau requis, avec un toast « X évolue ! » et une animation (flash blanc). `/tokemon stop` annule ; on peut relancer plus tard avec `/tokemon evolve`.
- Par pierre (Feu, Eau, Foudre, Plante, Lune) : `/tokemon use <pierre>` consomme la pierre.
- Par échange : avec un Link Cable (Kadabra, Machopeur, Gravalanch, Spectrum…).
- Évoli : `/tokemon evolve <aquali|voltali|pyroli>` (+ les évolutions des gens suivantes si leurs sprites sont téléchargés).
- Les données d'évolution sont dans `data/evolutions.js`, avec crédit au repo de référence et aux données officielles.

### 4.4 Rencontres sauvages et capture
- Toutes les `ENCOUNTER_EVERY = 5 000` output tokens cumulés, on tire au sort avec `ENCOUNTER_CHANCE = 35 %` (×2 sous Encens).
- Un mon sauvage apparaît dans la bande et dans le panneau, et un toast l'annonce. Il reste **10 minutes** ou jusqu'à **3 lancers ratés**, puis s'enfuit.
- Le pool est composé de tous les mons dont les sprites sont disponibles en local. Les formes évoluées sont plus rares (poids divisé par 3 au stade 2, par 9 au stade 3).
- Capture : `/tokemon catch [ball]`. Probabilité = `baseRate(rareté) × ballMultiplier`, plafonnée à 100 %.

| Rareté | Poids de spawn | Taux de base |
|---|---|---|
| Commun | 60 | 80 % |
| Peu commun | 25 | 60 % |
| Rare | 10 | 40 % |
| Épique | 4 | 20 % |
| Légendaire (Artikodin, Électhor, Sulfura, Mewtwo, Mew…) | 1 | 5 % |

| Ball | Multiplicateur |
|---|---|
| Poké Ball | ×1 |
| Super Ball | ×1,5 |
| Hyper Ball | ×2 |
| Master Ball | capture garantie |

- Shiny : 1/512 par rencontre (1/170 avec le Charme Chroma). Un shiny capturé reste shiny (variante de sprite `shiny_*`).
- Une capture ajoute le mon à la box (niveau aléatoire dans une fourchette selon la rareté) et au Pokédex. Un échec déclenche une animation de Ball qui s'ouvre.
- Les raretés sont définies dans `data/rarity.js`, construit à partir d'une liste éditable à la main.

### 4.5 Items et drops
- Toutes les `DROP_EVERY = 2 000` output tokens, on tire au sort avec `DROP_CHANCE = 15 %`, selon une table pondérée. La Master Ball est garantie aux paliers de 1M tokens cumulés.

| Catégorie | Item | Poids | Effet |
|---|---|---|---|
| Balls | Poké Ball | 30 | ×1 |
| | Super Ball | 12 | ×1,5 |
| | Hyper Ball | 5 | ×2 |
| | Master Ball | 0,2 | capture garantie |
| Pierres | Feu, Eau, Foudre, Plante, Lune | 3 chacune | évolution |
| | Link Cable | 2 | évolution par échange |
| Consommables | Super Bonbon | 6 | +1 niveau |
| | Baies (Oran, Sitrus…) | 10 | +X XP fixe |
| | Encens | 4 | rencontres ×2 pendant 30 min |
| Boosts | Lucky Egg | 3 | XP ×2 pendant 1 h |
| | Multi Exp | 2 | 25 % de l'XP partagés avec toute la box pendant 1 h |
| | Charme Chroma | 1 | shiny ×3 pendant 24 h |

- Les boosts sont horodatés via `$.clock`. Ils sont visibles dans le panneau avec leur temps restant, et un toast signale leur expiration.

### 4.6 Pokédex et succès
- Pokédex : vus / capturés / shiny par mon, avec un taux de complétion par génération.
- Succès (environ 20 en V1), par exemple : premier mon capturé, 10/50/151 capturés, premier shiny, 100k/1M/10M output tokens, premier légendaire, première évolution par pierre, un mon niveau 100, 7 jours d'affilée avec une session, Master Ball utilisée… Chaque succès déblocage donne un toast et une récompense d'item.

### 4.7 Dashboard de stats (dans le panneau)
- Output tokens par jour sur les 30 derniers jours (sparkline ou barres ASCII/pixel), tokens totaux, XP totale
- Captures, rencontres, taux de capture, shiny, items obtenus et utilisés
- Journal des 50 derniers événements (capture, évolution, drop, succès)

## 5. Interface

| Surface | Contenu |
|---|---|
| **Bande / status line** (au-dessus du prompt) | Compagnon actif animé (idle/walk, 8 fps), nom, niveau, barre d'XP, icônes des boosts actifs, mon sauvage quand il y en a un |
| **Panneau latéral** | Onglets : Équipe/Box · Sac · Pokédex · Succès · Stats. Ouvert avec `/tokemon pane` ; son état ouvert/fermé est persisté |
| **Toasts** | Niveau, évolution, rencontre, capture/échec, fuite, drop d'item, fin de boost, succès |
| **Slash commands** | Voir ci-dessous |

| Commande | Effet |
|---|---|
| `/tokemon` | Résumé : mon actif, niveau, XP, boosts |
| `/tokemon start <mon>` | Choisir le starter (premier lancement seulement) |
| `/tokemon switch <mon>` | Changer de mon actif |
| `/tokemon box` | Liste des mons capturés |
| `/tokemon bag` | Inventaire |
| `/tokemon use <item> [mon]` | Utiliser un item |
| `/tokemon evolve [forme]` / `/tokemon stop` | Évoluer / annuler |
| `/tokemon catch [ball]` | Lancer une Ball |
| `/tokemon dex` · `/tokemon achievements` · `/tokemon stats` | Pokédex · succès · stats |
| `/tokemon pane` | Ouvrir/fermer le panneau |
| `/tokemon nick <nom>` | Surnom du mon actif |
| `/tokemon shiny` / `default` | Variante d'affichage pour un mon shiny |
| `/tokemon download <gen2..gen5>` | Télécharger les sprites d'une génération |
| `/tokemon help` | Aide |
| `/tokemon debug <xp\|encounter\|drop> …` | Triche de dev (désactivée hors `TOKEMON_DEBUG=1`) |

## 6. Données et persistance

- Toute la persistance passe par `$.store` (clés versionnées), avec un schéma JSDoc :
  - `tokemon:v1:state` : `{ activeMonId, starterChosen, totals: { outputTokens, xp }, counters: { sinceEncounter, sinceDrop }, wild: {...}|null }`
  - `tokemon:v1:box` : `Mon[]` → `{ id, species, nickname, level, xp, shiny, caughtAt, evolvedFrom? }`
  - `tokemon:v1:bag` : `Record<ItemId, number>`
  - `tokemon:v1:boosts` : `{ id, expiresAt }[]`
  - `tokemon:v1:dex` : `Record<Species, { seen, caught, shiny }>`
  - `tokemon:v1:achievements` : `Record<AchievementId, unlockedAt>`
  - `tokemon:v1:history` : `{ date: 'YYYY-MM-DD', outputTokens, xp }[]` (rolling 365 j) + `events` (rolling 50)
- **Concurrence** : plusieurs sessions ouvertes partagent le store. Il faut gérer les écritures concurrentes (relecture avant écriture, merge des compteurs) et dédupliquer le comptage d'un même tour.
- **Migrations** : un module `migrations.js` appliqué au démarrage.

## 7. Sprites et assets

- Gen 1 : copier `sprites/` du repo de référence (GIF `default|shiny` × `idle|walk` à 8 fps) dans `sprites/`, avec un `CREDITS.md` (dgokcin/claude-pokemon-mod, sprites originaux de jakobhoeg/vscode-pokemon, Pokémon © Nintendo/Game Freak, usage personnel non commercial).
- Gens 2 à 5 : téléchargement à la demande depuis la même source que la référence (`jakobhoeg/vscode-pokemon`, dossier `media`, via l'API contents de GitHub), avec mise en cache locale. Les mons non téléchargés ne sortent pas dans les rencontres.
- Rendu : décodage GIF → frames → rendu dans la bande et le panneau (étudier `png.js`, `frames.js` et `paint.js` de la référence pour les contraintes de rendu terminal/desktop, mais réimplémenter).

## 8. Architecture cible

```
tokemon/
├─ .claude-plugin/{plugin.json, marketplace.json}
├─ hooks/
│  ├─ hooks.json
│  ├─ register.js        # wiring des events et commandes uniquement
│  ├─ config.js          # toutes les constantes d'équilibrage
│  ├─ core/              # logique pure, sans $ (testable)
│  │  ├─ xp.js  levels.js  evolution.js  encounter.js  capture.js
│  │  ├─ drops.js  boosts.js  achievements.js  stats.js  rng.js
│  ├─ data/              # species.js, evolutions.js, rarity.js, items.js, achievements.js
│  ├─ store/             # schema.js, repo.js, migrations.js
│  ├─ tokens/            # getOutputTokens + stratégies (payload/transcript/estimate)
│  ├─ ui/                # band.js, pane/*.js, toasts.js, render/(gif, frames, paint)
│  └─ commands/          # un fichier par sous-commande
├─ sprites/  CREDITS.md
├─ scripts/  # stub-host.mjs, preview-*.mjs, check-data.mjs
├─ tests/
└─ docs/     # token-source.md, architecture.md, balancing.md
```

- **Règle d'archi** : `core/` est 100 % pur (RNG injectable avec seed, horloge injectée), et c'est la seule couche avec de la logique métier. `register.js` ne fait que router.

## 9. Qualité et livrables

- Tests unitaires du `core/` avec ≥ 80 % de couverture : XP, courbe, évolutions, capture, tirages (seedés), boosts, succès, migrations
- `scripts/check-data.mjs` vérifie que chaque espèce a ses sprites, une rareté et des évolutions cohérentes
- Scripts de preview qui rendent la bande et le panneau via le stub host, sans Claude
- README : installation (marketplace locale), commandes, équilibrage, crédits
- Conventional Commits, CHANGELOG (git-cliff)

### Critères d'acceptation
1. À l'ouverture d'une session dans l'onglet Code, le compagnon s'affiche sans commande ; au premier lancement, le choix du starter est proposé.
2. Après un tour, l'XP du mon actif augmente proportionnellement aux output tokens réels (ou estimés, et signalés comme tels).
3. Au niveau requis, l'évolution se déclenche (sprite changé, toast) ; les pierres et le Link Cable fonctionnent via `/tokemon use`.
4. Une rencontre forcée (`debug encounter`) apparaît ; `/tokemon catch` applique les bons taux ; le mon rejoint box et dex.
5. Les drops alimentent le sac ; les boosts modifient XP, rencontres ou shiny pendant leur durée puis expirent.
6. Le panneau affiche Équipe, Sac, Dex, Succès et Stats avec des données correctes.
7. Avec deux sessions ouvertes, il n'y a ni double comptage ni perte d'état.
8. La CI est verte (biome, tsc checkJs, tests, check-data).

## 10. Risques

| Risque | Mitigation |
|---|---|
| Output tokens non exposés par l'API des mods | Stratégies en cascade (§3), estimation en dernier recours |
| API des mods instable ou peu documentée | Isoler les appels `$` dans `register.js`/`ui/`, s'appuyer sur la référence |
| Rendu différent entre Desktop et terminal | Tester les deux et dégrader proprement (texte si pas d'image) |
| Droits sur les assets | Repo privé, usage perso, crédits |
| Scope « ultra complet » trop large pour un seul passage | Livraison par lots (§11), une PR par lot |

## 11. Plan de livraison pour l'agent

1. **Lot 0, socle** : scaffolding, plugin.json/hooks.json, Biome, tsc checkJs, CI, stub host, `docs/token-source.md` (le point bloquant)
2. **Lot 1, compagnon** : sprites + rendu dans la bande, starter, auto-start, XP/niveaux, switch, persistance
3. **Lot 2, évolutions** : données, évolution par niveau, pierres, échange, Évoli
4. **Lot 3, rencontres et capture** : raretés, shiny, Balls, Pokédex
5. **Lot 4, items** : drops, sac, consommables, boosts
6. **Lot 5, panneau** : onglets, dashboard stats, historique
7. **Lot 6, succès et finition** : succès, toasts, help, README, téléchargement gens 2 à 5

Chaque lot se termine par des tests verts, un commit propre et une note dans `CHANGELOG.md`. En cas de doute sur une règle de jeu, choisir la valeur la plus simple, la rendre configurable dans `config.js` et la documenter dans `docs/balancing.md`.
