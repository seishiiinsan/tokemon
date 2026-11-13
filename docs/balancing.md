# Équilibrage et règles de jeu

Toutes les valeurs sont dans [`hooks/config.js`](../hooks/config.js). Ce document liste les règles, et
surtout **les choix faits là où le cahier des charges laissait une marge** (repérés par ⚙).

## XP et niveaux

| Règle | Valeur | Constante |
|---|---|---|
| XP par output token | 1 | `XP_PER_TOKEN` |
| XP totale pour le niveau n | n³ (niv. 50 = 125 000, niv. 100 = 1 000 000) | `LEVEL_CURVE_EXPONENT` |
| Niveau du starter | 5 | `STARTER_LEVEL` |
| Inventaire de départ | 10 Poké Balls, 1 Super Bonbon | `STARTER_BAG` |

- ⚙ `XP_PER_TOKEN = 1` : le CDC ne fixe pas la valeur. À 1, un mon atteint le niveau 100 en 1 M de tokens.
- Les tours des subagents comptent : chacun a son propre `turn.complete` et son usage n'est pas inclus dans
  celui du tour principal (vérifié, voir `token-source.md`).
- ⚙ Multi Exp : chaque autre mon de la box reçoit 25 % de l'XP gagnée **en bonus** (le compagnon garde 100 %).
- ⚙ Lucky Egg et Multi Exp se cumulent. Réactiver un boost déjà actif ajoute sa durée au temps restant.

## Évolutions

- Par niveau : annoncée dès que le compagnon atteint le niveau requis, appliquée après
  `EVOLUTION_DELAY_MS` (15 s). `/tokemon stop` pendant ce délai annule et **bloque** les annonces
  suivantes pour ce mon, jusqu'à `/tokemon evolve`.
- ⚙ Seul le **compagnon actif** évolue automatiquement. Un mon de la box qui a dépassé son niveau
  d'évolution évolue quand il redevient actif et gagne de l'XP, ou tout de suite avec `/tokemon evolve`.
- Pierres et Link Cable : `/tokemon use <item> [mon]`, sur le compagnon ou n'importe quel mon de la box.
- ⚙ Espèces à plusieurs branches (Évoli, Ortide, Têtarte…) : `/tokemon evolve <forme>` applique la
  condition de la branche choisie (consomme la pierre ou le Link Cable, ou vérifie le niveau).
  `/tokemon use pierre eau` sur Évoli donne aussi Aquali.
- ⚙ Méthodes officielles absentes de la V1 (bonheur, lieu, objet tenu, attaque apprise, autres pierres) :
  repli sur un niveau, `max(FALLBACK_EVOLUTION_LEVEL = 30, niveau de l'évolution précédente + 10)`,
  ou `FALLBACK_BABY_EVOLUTION_LEVEL = 15` pour un bébé (Pichu, Toudoudou…). Exemples : Mentali et Noctali
  au niveau 30, Nostenfer au niveau 32. Un échange avec objet tenu (Onix → Steelix) demande juste un Link Cable.
- Une évolution n'est proposée que si les sprites de la cible sont en local.

## Rencontres et capture

| Règle | Valeur | Constante |
|---|---|---|
| Un tirage tous les | 5 000 output tokens cumulés | `ENCOUNTER_EVERY` |
| Chance par tirage | 35 % (×2 sous Encens, plafonnée à 100 %) | `ENCOUNTER_CHANCE` |
| Durée de présence | 10 min | `WILD_DURATION_MS` |
| Lancers ratés avant la fuite | 3 | `WILD_MAX_FAILED_THROWS` |
| Shiny | 1/512 (×3 sous Charme Chroma) | `SHINY_CHANCE` |

| Rareté | Poids de spawn | Taux de base | Niveau à la capture ⚙ |
|---|---|---|---|
| Commun | 60 | 80 % | 2 à 12 |
| Peu commun | 25 | 60 % | 8 à 20 |
| Rare | 10 | 40 % | 15 à 30 |
| Épique | 4 | 20 % | 25 à 45 |
| Légendaire | 1 | 5 % | 50 à 70 |

- Poids d'une espèce = poids de sa rareté ÷ 1, 3 ou 9 selon son stade (`STAGE_WEIGHT_DIVISORS`).
- ⚙ Le poids est aussi divisé par le nombre de formes qui partagent le même numéro de Pokédex : les 28 Zarbi
  pèsent ensemble comme une seule espèce.
- ⚙ Un seul mon sauvage à la fois. Tant qu'il est là, les paliers franchis ne donnent pas de tirage (ils sont consommés).
- ⚙ Pas de rencontre ni de drop avant le choix du starter.
- Capture : `min(1, taux de base × multiplicateur)`. Poké ×1, Super ×1,5, Hyper ×2, Master garantie.
- ⚙ `/tokemon catch` sans argument lance la Ball la plus simple du sac (Poké, puis Super, Hyper, Master).
- Les raretés sont des listes éditables dans [`hooks/data/rarity.js`](../hooks/data/rarity.js) : un identifiant
  désigne une espèce ou la forme de base d'une lignée (toute la lignée hérite). Non listé = commun.

## Drops

Un tirage à 15 % (`DROP_CHANCE`) tous les 2 000 output tokens (`DROP_EVERY`), puis tirage pondéré :

| Item | Poids | Effet |
|---|---|---|
| Poké Ball / Super Ball / Hyper Ball / Master Ball | 30 / 12 / 5 / 0,2 | capture ×1 / ×1,5 / ×2 / garantie |
| Pierres Feu, Eau, Foudre, Plante, Lune | 3 chacune | évolution |
| Link Cable | 2 | évolution par échange |
| Super Bonbon | 6 | +1 niveau |
| Baie Oran / Baie Sitrus ⚙ | 7 / 3 | +500 XP / +2 000 XP |
| Encens | 4 | rencontres ×2 pendant 30 min |
| Lucky Egg | 3 | XP ×2 pendant 1 h |
| Multi Exp | 2 | 25 % de l'XP à toute la box pendant 1 h |
| Charme Chroma | 1 | shiny ×3 pendant 24 h |

- ⚙ Le poids 10 des « baies » du CDC est réparti entre deux baies (7 + 3).
- Une Master Ball est garantie à chaque palier de 1 M de tokens cumulés (`MASTER_BALL_MILESTONE`).
- Les poids sont dans [`hooks/data/items.js`](../hooks/data/items.js) (`dropWeight`).

## Succès

20 succès, définis dans [`hooks/data/achievements.js`](../hooks/data/achievements.js) (libellé, récompense) et
[`hooks/core/achievements.js`](../hooks/core/achievements.js) (condition). Chacun donne un toast et un item.

- ⚙ « 10/50/151 capturés » compte les captures ; « Pokédex 25/100 » compte les espèces distinctes
  (starter et évolutions compris).
- ⚙ La série de jours compte les jours calendaires locaux où une session a démarré.

## Pokédex

Indexé par espèce (dossier de sprites), complétion par génération comptée par numéro de Pokédex : les
formes (Zarbi A à Z, Pikachu ♀…) comptent une fois. Un mon obtenu sans rencontre (starter, évolution)
compte comme vu et capturé.
