#!/usr/bin/env node
// Valide les manifestes du plugin et la cohérence des tables de jeu. Lancé par la CI.
// - chaque espèce de la gen 1 a ses quatre GIF et son sprite compilé ;
// - chaque espèce a une rareté et un stade valides ;
// - les évolutions pointent vers des espèces connues, sans cycle, avec des items existants ;
// - les tables d'items, de drops, de boosts et de succès se recoupent avec config.js.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as config from '../hooks/config.js'
import { ACHIEVEMENT_LIST } from '../hooks/data/achievements.js'
import { EVOLUTIONS } from '../hooks/data/evolutions.js'
import { GEN1_SPRITES } from '../hooks/data/frames.gen1.js'
import { ITEM_LIST, ITEMS } from '../hooks/data/items.js'
import { findSpecies } from '../hooks/data/lookup.js'
import { RARITY_LISTS, rarityOf } from '../hooks/data/rarity.js'
import { SPECIES } from '../hooks/data/species.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** @type {string[]} */
const errors = []
/** @type {string[]} */
const warnings = []
/** @param {unknown} condition @param {string} message */
const check = (condition, message) => void (condition || errors.push(message))
/** @param {string} path */
const json = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'))

// ── Manifestes ───────────────────────────────────────────────────────────────
const plugin = json('.claude-plugin/plugin.json')
const marketplace = json('.claude-plugin/marketplace.json')
const hooks = json('hooks/hooks.json')
check(/^[a-z0-9-]{1,64}$/.test(plugin.name), 'plugin.json : nom invalide')
check(plugin.version === json('package.json').version, 'plugin.json et package.json : versions différentes')
check(
  marketplace.plugins?.some((/** @type {{ name: string }} */ entry) => entry.name === plugin.name),
  'marketplace.json ne liste pas le plugin',
)
for (const module of hooks.modules ?? [])
  check(existsSync(join(ROOT, 'hooks', module)), `hooks.json : module introuvable ${module}`)
check(hooks.modules?.length === 1, 'hooks.json : un seul module attendu')

// ── Espèces et sprites ───────────────────────────────────────────────────────
const speciesIds = Object.keys(SPECIES)
check(speciesIds.length > 600, `seulement ${speciesIds.length} espèces`)
const spriteFolders = new Set(
  readdirSync(join(ROOT, 'sprites'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
)
for (const [id, species] of Object.entries(SPECIES)) {
  check(species.dex >= 1 && species.dex <= 649, `${id} : numéro de Pokédex ${species.dex}`)
  check(species.gen >= 1 && species.gen <= 5, `${id} : génération ${species.gen}`)
  check(species.stage >= 1 && species.stage <= 3, `${id} : stade ${species.stage}`)
  check(species.name && species.en, `${id} : nom manquant`)
  check(rarityOf(id) in config.RARITIES, `${id} : rareté inconnue`)
  check(findSpecies(id) === id, `${id} : introuvable par son identifiant`)
  if (species.gen !== 1) continue
  check(spriteFolders.has(id), `${id} : dossier sprites/${id} manquant`)
  for (const variant of config.SPRITE_VARIANTS) {
    for (const anim of config.SPRITE_ANIMS) {
      check(
        existsSync(join(ROOT, 'sprites', id, `${variant}_${anim}_8fps.gif`)),
        `${id} : ${variant}_${anim}_8fps.gif manquant`,
      )
      const frames = GEN1_SPRITES[id]?.variants[variant]?.[anim]
      check(frames?.length > 0, `${id} : frames ${variant}/${anim} absentes de frames.gen1.js (npm run build:frames)`)
      for (const frame of frames ?? []) {
        check(
          frame.px.length === GEN1_SPRITES[id].w * GEN1_SPRITES[id].h,
          `${id} : frame ${variant}/${anim} de mauvaise taille`,
        )
      }
    }
  }
}
for (const folder of spriteFolders) check(SPECIES[folder]?.gen === 1, `sprites/${folder} : pas une espèce de la gen 1`)
for (const starter of config.STARTERS)
  check(SPECIES[starter]?.gen === 1, `starter inconnu ou non embarqué : ${starter}`)

// ── Raretés ──────────────────────────────────────────────────────────────────
const knownIds = new Set(Object.values(SPECIES).flatMap((species) => [species.base, species.family]))
/** @type {Map<string, string>} */
const listedIn = new Map()
for (const [rarity, ids] of Object.entries(RARITY_LISTS)) {
  for (const id of ids) {
    check(!listedIn.has(id), `rareté : ${id} est dans ${listedIn.get(id)} et ${rarity}`)
    listedIn.set(id, rarity)
    // Une espèce sans dossier de sprites en amont (gen 5 incomplète) : simple avertissement
    if (!knownIds.has(id)) warnings.push(`rareté ${rarity} : ${id} n'a pas de sprites en amont`)
  }
}
for (const rule of Object.values(config.RARITIES)) {
  check(
    rule.spawnWeight > 0 && rule.catchRate > 0 && rule.catchRate <= 1,
    `rareté ${rule.label} : poids ou taux invalide`,
  )
  check(
    rule.levelRange[0] >= 1 && rule.levelRange[0] <= rule.levelRange[1] && rule.levelRange[1] <= config.MAX_LEVEL,
    `rareté ${rule.label} : fourchette de niveau invalide`,
  )
}

// ── Évolutions ───────────────────────────────────────────────────────────────
for (const [from, list] of Object.entries(EVOLUTIONS)) {
  check(from in SPECIES, `évolution depuis une espèce inconnue : ${from}`)
  for (const evolution of list) {
    const target = SPECIES[evolution.to]
    check(target, `${from} → ${evolution.to} : espèce inconnue`)
    if (!target) continue
    check(
      target.stage === SPECIES[from].stage + 1,
      `${from} → ${evolution.to} : stades incohérents (${SPECIES[from].stage} → ${target.stage})`,
    )
    check(target.family === SPECIES[from].family, `${from} → ${evolution.to} : lignées différentes`)
    if (evolution.type === 'level')
      check(
        evolution.level >= 2 && evolution.level <= config.MAX_LEVEL,
        `${from} → ${evolution.to} : niveau ${evolution.level}`,
      )
    if (evolution.type === 'stone')
      check(ITEMS[evolution.item]?.kind === 'stone', `${from} → ${evolution.to} : pierre inconnue ${evolution.item}`)
  }
}
for (const start of Object.keys(EVOLUTIONS)) {
  const seen = new Set([start])
  let frontier = [start]
  while (frontier.length > 0) {
    const next = frontier.flatMap((id) => (EVOLUTIONS[id] ?? []).map((evolution) => evolution.to))
    for (const id of next) check(!seen.has(id) || id !== start, `cycle d'évolution à partir de ${start}`)
    frontier = next.filter((id) => !seen.has(id))
    for (const id of frontier) seen.add(id)
  }
}
check(EVOLUTIONS.eevee?.length >= 3, 'Évoli doit avoir au moins trois évolutions')
check(EVOLUTIONS.kadabra?.[0]?.type === 'trade', 'Kadabra doit évoluer par échange')

// ── Items, boosts, succès ────────────────────────────────────────────────────
check(new Set(ITEM_LIST.map((item) => item.id)).size === ITEM_LIST.length, 'items : identifiants en double')
const aliases = ITEM_LIST.flatMap((item) => item.aliases)
check(new Set(aliases).size === aliases.length, 'items : alias en double')
for (const item of ITEM_LIST)
  check(item.dropWeight >= 0 && item.name && item.effect, `item ${item.id} : entrée incomplète`)
for (const id of Object.keys(config.BALL_MULTIPLIERS)) check(ITEMS[id]?.kind === 'ball', `Ball inconnue : ${id}`)
for (const id of Object.keys(config.BERRY_XP)) check(ITEMS[id]?.kind === 'berry', `baie inconnue : ${id}`)
for (const id of Object.keys(config.BOOST_DURATIONS)) check(ITEMS[id]?.kind === 'boost', `boost inconnu : ${id}`)
for (const item of ITEM_LIST) {
  if (item.kind === 'ball') check(item.id in config.BALL_MULTIPLIERS, `Ball sans multiplicateur : ${item.id}`)
  if (item.kind === 'berry') check(item.id in config.BERRY_XP, `baie sans XP : ${item.id}`)
  if (item.kind === 'boost') check(item.id in config.BOOST_DURATIONS, `boost sans durée : ${item.id}`)
}
for (const id of Object.keys(config.STARTER_BAG)) check(id in ITEMS, `inventaire de départ : item inconnu ${id}`)
check(
  new Set(ACHIEVEMENT_LIST.map((achievement) => achievement.id)).size === ACHIEVEMENT_LIST.length,
  'succès : identifiants en double',
)
for (const achievement of ACHIEVEMENT_LIST) {
  check(
    achievement.reward.item in ITEMS && achievement.reward.count > 0,
    `succès ${achievement.id} : récompense invalide`,
  )
}

for (const warning of warnings) console.warn('⚠ ' + warning)
if (errors.length > 0) {
  console.error(errors.map((error) => '✗ ' + error).join('\n'))
  process.exit(1)
}
console.log(
  `✓ données valides : ${speciesIds.length} espèces, ${spriteFolders.size} sprites embarqués, ${Object.keys(EVOLUTIONS).length} lignes d'évolution, ${ITEM_LIST.length} items, ${ACHIEVEMENT_LIST.length} succès`,
)
