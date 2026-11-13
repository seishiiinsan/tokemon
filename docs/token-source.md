# Source des output tokens (Lot 0)

**Verdict : stratégie 1.** Le payload de `turn.complete` porte l'usage réel du tour
(`e.usage.output_tokens`). Aucune estimation n'est nécessaire en fonctionnement normal.

Tout le mod passe par une fonction unique : `getOutputTokens(turn, context)` dans
`hooks/tokens/index.js`, qui renvoie `{ tokens, source, approximate }`.

## Ce qui a été vérifié

Environnement : Claude Code **2.1.323**, plugin sonde chargé avec `claude -p … --plugin-dir`,
qui écrit les payloads bruts de `turn.step` et `turn.complete` dans un fichier.

### 1. Tour simple (boucle principale)

```json
{"ev":"turn.step","e":{"turnId":"07719018-…","index":0},
 "usage":{"input_tokens":2,"output_tokens":4,"cache_read_input_tokens":26302,"cache_creation_input_tokens":11247,"model":"claude-opus-5-5"},
 "stopReason":"end_turn"}
{"ev":"turn.complete","e":{"answer":"pong","durationMs":2009,"isAborted":false,"turnId":"07719018-…","reason":"answer",
 "usage":{"input_tokens":2,"output_tokens":4,"cache_read_input_tokens":26302,"cache_creation_input_tokens":11247,"model":"claude-opus-5-5"}}}
```

### 2. Tour avec un subagent (outil Agent)

```json
{"ev":"turn.step","e":{"turnId":"475004e3-…","index":0},"usage":{"output_tokens":138,…},"stopReason":"tool_use"}
{"ev":"turn.step","e":{"turnId":"cd303ea3-…","index":0,"agentId":"af1f54fc74f3b8cb0"},"usage":{"output_tokens":4,…},"stopReason":"end_turn"}
{"ev":"turn.complete","e":{"answer":"pong","turnId":"cd303ea3-…","agentId":"af1f54fc74f3b8cb0","reason":"answer","usage":{"output_tokens":4,…}}}
{"ev":"turn.step","e":{"turnId":"475004e3-…","index":1},"usage":{"output_tokens":3,…},"stopReason":"end_turn"}
{"ev":"turn.complete","e":{"answer":"done","turnId":"475004e3-…","reason":"answer","usage":{"output_tokens":141,…}}}
```

Ce que ça établit :

| Fait observé | Conséquence dans le code |
|---|---|
| `turn.complete.usage.output_tokens` = somme des `turn.step` du tour (138 + 3 = 141) | on lit `turn.complete`, inutile de hooker le stream `turn.step` |
| Le subagent a son propre `turn.complete`, avec `agentId` et son propre `turnId` | ses tokens sont comptés par le même hook (CDC §4.2) |
| L'usage du tour principal **n'inclut pas** celui du subagent (141 ≠ 145) | additionner tous les `turn.complete` ne double-compte rien |
| Chaque tour a un `turnId` stable | sert de clé de déduplication (`state.seenTurns`) |
| `usage` est absent quand rien n'a compté (interruption, erreur API), d'après les types | on retombe sur la cascade ci-dessous |

Les types de l'API (`TurnCompleteFields.usage?: TurnUsage`, `TurnUsage = ModelUsage & { model }`)
confirment la forme. Ils sont générés par le moteur à chaque build : la référence fait foi si
l'API bouge.

## Cascade implémentée

| Ordre | Stratégie | Fichier | Statut |
|---|---|---|---|
| 1 | Payload `turn.complete` → `usage.output_tokens` | `tokens/payload.js` | **retenue, vérifiée en live** |
| 2 | Autre API du host | — | écartée : `$.session.usage()` donne la fenêtre de contexte et le coût, pas les output tokens par tour |
| 3 | Transcript JSONL (`message.usage.output_tokens`, dédupliqué par `message.id`) | `tokens/transcript.js` | implémentée et testée sur fixtures, **non branchée** (voir ci-dessous) |
| 4 | Estimation `longueur de la réponse / 4` | `tokens/estimate.js` | filet de sécurité, signalée par `≈` dans l'UI |

La stratégie 3 est prête mais `register.js` ne lui fournit pas de lecteur de transcript : le
chemin du fichier n'est exposé au mod que par les événements `classic.*` (`transcript_path`),
et `$.fs.read` est plafonné à 4 Mio, ce qu'un long transcript dépasse. Comme la stratégie 1
fonctionne, le fallback effectif d'un tour sans usage (interrompu, en erreur) est l'estimation.
Pour brancher le transcript, il suffit de passer `readTranscript` à `getOutputTokens`.

Les tokens estimés sont comptés à part (`state.totals.approximateTokens`) : la bande et
`/tokemon stats` affichent `≈` dès qu'une partie du total est une estimation.

## Vérification de bout en bout

Le mod complet a ensuite été chargé dans le vrai moteur (`claude -p … --plugin-dir .`, 2.1.323) :

- `/tokemon start salamèche` → « Salamèche devient ton compagnon ! » ;
- un tour réel de 201 output tokens → `totals.xp = 201`, Salamèche passe du niveau 5 au niveau 6 ;
- le store du plugin (`~/.claude/plugins/store/tokemon_inline-….json`) contient bien les 7 clés `tokemon:v1:*`.

## À revérifier manuellement

- Dans **l'onglet Code de Claude Desktop** (le test a été fait en CLI headless) : même payload attendu,
  le moteur étant le même, mais à confirmer avec `/tokemon debug tokens`, qui affiche la dernière mesure et sa source.
- Les tours d'un **subagent en arrière-plan** ou d'un teammate : le hook les entend d'après les types
  (« every hook hears an agent's end »), un seul cas simple a été testé.
- Au premier test, la sonde a signalé une fois : `hooks modules are turned off for installed plugins in this
  process: this wake's flag fetch has not answered the rollout switch`. Les modules de hooks sont derrière un
  flag de déploiement côté Anthropic : si le mod ne se charge pas, c'est la première piste.
