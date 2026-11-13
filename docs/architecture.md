# Architecture

```
tokemon/
├─ .claude-plugin/{plugin.json, marketplace.json}
├─ hooks/
│  ├─ hooks.json          modules: ["./register.js"]
│  ├─ register.js         routage des événements + adaptateur de $ (seul fichier qui touche à $)
│  ├─ app.js              runtime : relie hôte, store, core et UI (aucune règle de jeu)
│  ├─ config.js           toutes les constantes d'équilibrage et de réglage
│  ├─ types.js            contrat JSDoc de l'hôte (Host) et des événements
│  ├─ core/               logique de jeu, sans E/S (RNG et horloge injectés)
│  ├─ data/               espèces, évolutions, raretés, items, succès, frames gen 1
│  ├─ store/              schéma, migrations, transactions
│  ├─ tokens/             getOutputTokens() et ses stratégies
│  ├─ sprites/            téléchargement et cache des gens 2 à 5
│  ├─ ui/                 bande, scène, panneau, toasts, rendu (GIF, frames, dessin)
│  └─ commands/           un fichier par sous-commande de /tokemon
├─ sprites/               GIF de la gen 1 + CREDITS.md
├─ scripts/               stub-host, previews, check-data, build-frames, build-data, fetch-gen
├─ tests/                 node:test (core, store, tokens, ui, intégration via le stub)
└─ docs/
```

## Flux d'un tour

```
turn.complete (moteur)
  └─ register.js           app.onTurn(hostOf($), e)
       └─ app.js           getOutputTokens(e)            → { tokens, source, approximate }
            └─ repo.transact(save => applyTurn(save, turn, ctx))
                 └─ core/turn.js   déduplication, entretien, XP, évolution, rencontres, drops, succès, historique
            └─ announce(events)    toasts + animations de la scène + redessin
```

## Règles d'architecture

1. **`core/` ne fait aucune E/S.** Pas de `$`, pas de `Date.now()`, pas de `Math.random()` : l'horloge
   (`ctx.now`), l'aléa (`ctx.rng`, semable) et la liste des sprites disponibles (`ctx.available`) sont
   injectés. C'est la seule couche qui contient des règles de jeu. Convention : une fonction du core
   **modifie le `Save` qu'on lui passe** et renvoie les événements produits (`GameEvent[]`) ou un
   `ActionResult`. Le `Save` vient toujours d'être relu du store par `repo.transact`, donc personne
   d'autre ne le tient.
2. **`register.js` ne fait que router**, et c'est le seul fichier qui écrit `$`. Le moteur impose que
   chaque appel soit écrit `$.nom.méthode(...)` sur place (`claude plugin validate` refuse un `$` passé à
   un autre module). `hostOf($)` enveloppe donc chaque appel dans une fonction : le reste du mod ne
   connaît que cet adaptateur, typé par `Host` (`types.js`). Bénéfices : le stub de test implémente
   la même interface, et un changement de l'API des mods ne touche que `register.js`.
3. **Toutes les constantes d'équilibrage sont dans `config.js`**, les tables dans `data/`.
4. **L'UI ne décide de rien.** `ui/` transforme un `Save` en arbre d'éléments ; les boutons du panneau
   appellent des actions du runtime qui passent par le core.

## Persistance et concurrence

Clés du store (`$.store`, un fichier JSON propre au plugin, plafonné à 4 Mio) :

| Clé | Contenu |
|---|---|
| `tokemon:v1:state` | mon actif, totaux, compteurs, mon sauvage, évolution en attente, tours vus, stats, série, panneau |
| `tokemon:v1:box` | `Mon[]` |
| `tokemon:v1:bag` | `Record<ItemId, number>` |
| `tokemon:v1:boosts` | `{ id, expiresAt }[]` |
| `tokemon:v1:dex` | `Record<Species, { seen, caught, shiny }>` |
| `tokemon:v1:achievements` | `Record<AchievementId, unlockedAt>` |
| `tokemon:v1:history` | `{ days: [{ date, outputTokens, xp }] (365 j), events: [...] (50) }` |

Plusieurs sessions partagent ce store. `store/repo.js` :

- met en file les transactions d'une session (jamais deux en parallèle) ;
- **relit le store au début de chaque transaction**, applique la modification sur ces données fraîches,
  et n'écrit que les clés qui ont changé. Un incrément part donc toujours de la dernière valeur écrite,
  même si la copie locale de la session (utilisée seulement pour dessiner) est périmée ;
- le comptage d'un tour est dédupliqué dans le core par `agentId:turnId` (`state.seenTurns`, 300 derniers).

Limite connue : il n'y a pas de verrou entre processus. Deux sessions qui écrivent la même clé dans la
même fenêtre de quelques millisecondes (entre la lecture et l'écriture d'une transaction) peuvent perdre
une des deux écritures. C'est rare (une transaction par tour ou par commande) et sans gravité (quelques
tokens), mais ce n'est pas une garantie stricte.

`store/migrations.js` s'applique à chaque chargement : migrations versionnées (`state.version`), puis
normalisation (champs manquants complétés par les valeurs par défaut).

Les sprites téléchargés ne vont pas dans le store (trop gros) mais dans `~/.claude/tokemon/sprites/genN.json`.

## Rendu

- `ui/render/gif.js` : décodeur GIF89a (LZW, palettes, transparence, disposal, entrelacement), utilisé
  au build (`scripts/build-frames.mjs`), par `scripts/fetch-gen.mjs` et à l'exécution par `/tokemon download`.
  Vérifié au pixel près contre les frames de la référence (décodées par ffmpeg) sur les 153 sprites de la gen 1.
- `ui/render/frames.js` : format compact (une chaîne par image, palette par variante) et registre des sprites.
- `ui/render/paint.js` : toile de pixels → cellules de `Raster` (demi-blocs, 2 pixels par cellule) pour
  le terminal, ou `Svg` pour le desktop, qui n'a pas de `Raster`.
- `ui/scene.js` : la scène animée (marche, saut à la montée de niveau, flash d'évolution, Ball).
- Animation : un timer `$.clock.every(125 ms)`. Terminal : `$.ui.blit` repeint le `Raster` monté quand
  l'image change, sans redessin. Desktop : `$.ui.invalidate('ui.render')` tous les 2 ticks.
- Repli : sans place (moins de 42 colonnes ou de 3 lignes) ou sans sprite, la bande n'affiche que le texte.

## Tests

`scripts/stub-host.mjs` charge le vrai `register.js` avec un faux `$` (store en mémoire partageable entre
deux « sessions », horloge manuelle, UI enregistrée, fichiers et HTTP simulés). Les tests d'intégration
jouent des scénarios complets ; les tests du core utilisent un RNG semé ou des tirages imposés.

## Écarts avec l'arborescence du CDC

- `hooks/app.js` (runtime) et `hooks/types.js` en plus : pour que `register.js` reste un simple routeur.
- `hooks/sprites/` en plus : téléchargement et cache des gens 2 à 5.
- `hooks/core/` contient aussi `turn.js` (orchestration), `team.js`, `items.js`, `events.js`, `context.js`.
- `hooks/data/lookup.js` (recherche d'espèce) et `frames.gen1.js` (généré).
