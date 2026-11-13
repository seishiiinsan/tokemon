#!/usr/bin/env node
// Génère hooks/data/species.js et hooks/data/evolutions.js.
//
// Sources (outils de dev uniquement, rien n'est chargé à l'exécution du mod) :
// - scripts/data/sprite-slugs.json : les dossiers de sprites de jakobhoeg/vscode-pokemon (media/genN)
// - @pkmn/dex (données Pokémon Showdown, MIT) : numéros de Pokédex, chaînes et méthodes d'évolution
// - pokemon (sindresorhus, MIT) : noms français
// Les méthodes d'évolution de la gen 1 recoupent celles de dgokcin/claude-pokemon-mod (hooks/evolutions.js).
//
// Usage : node scripts/build-data.mjs

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Dex } from '@pkmn/dex'
import pokemon from 'pokemon'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** @type {Record<string, string[]>} */
const SLUGS = JSON.parse(readFileSync(join(ROOT, 'scripts/data/sprite-slugs.json'), 'utf8'))
const MAX_DEX = 649
/** @type {Record<string, string>} */
// Les deux derniers sont des fautes de frappe du dépôt de sprites (Gothorita, Mienfoo)
const SPECIAL_IDS = { nidoran_female: 'nidoranf', nidoran_male: 'nidoranm', gorthorita: 'gothorita', mienfo: 'mienfoo' }
/** @type {Record<string, string>} */
const STONES = {
  'Fire Stone': 'fire-stone',
  'Water Stone': 'water-stone',
  'Thunder Stone': 'thunder-stone',
  'Leaf Stone': 'leaf-stone',
  'Moon Stone': 'moon-stone',
}
/** @type {Record<string, string>} */
const FORM_LABELS = { female: '♀', male: '♂', exclamation: '!', question: '?' }

const dex = Dex.forGen(9)
/** @param {string} text */
const toId = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * Le dossier de sprites rapporté à son espèce Showdown, et le suffixe de forme éventuel.
 * @param {string} slug
 */
function resolve(slug) {
  const full = dex.species.get(SPECIAL_IDS[slug] ?? toId(slug))
  if (full.exists && full.num > 0 && full.num <= MAX_DEX) {
    const base = dex.species.get(full.baseSpecies)
    // Les formes purement cosmétiques (Zarbi A, Cheniti Plante…) n'ont pas de `forme` : on garde le suffixe
    const suffix = slug in SPECIAL_IDS ? '' : slug.split('_').slice(1).join(' ')
    const form = full.forme ? full.forme.toLowerCase().replace(/[^a-z0-9]+/g, ' ') : suffix || null
    return { base, form }
  }
  const [head, ...rest] = slug.split('_')
  const base = dex.species.get(toId(head))
  if (!base.exists || base.num > MAX_DEX) throw new Error(`Espèce inconnue pour le dossier « ${slug} »`)
  return { base: dex.species.get(base.baseSpecies), form: rest.join(' ') || null }
}

/** @param {import('@pkmn/dex').Species} species */
function rootOf(species) {
  let current = species
  let depth = 1
  while (current.prevo) {
    const prevo = dex.species.get(current.prevo)
    if (!prevo.exists || prevo.num > MAX_DEX) break
    current = prevo
    depth++
  }
  return { root: current, stage: depth }
}

/** @type {Record<string, any>} */
const species = {}
/** @type {Map<string, string[]>} */
const slugsByBase = new Map()
for (const [genKey, slugs] of Object.entries(SLUGS)) {
  const gen = Number(genKey.replace('gen', ''))
  for (const slug of slugs) {
    const { base, form } = resolve(slug)
    const { root, stage } = rootOf(base)
    const label = form ? (FORM_LABELS[form] ?? form) : null
    const fr = pokemon.getName(base.num, 'fr')
    species[slug] = {
      dex: base.num,
      gen,
      name: label ? `${fr} (${label})` : fr,
      en: base.name,
      stage,
      family: root.id,
      base: base.id,
      ...(form ? { form: form.replace(/ /g, '_') } : {}),
    }
    slugsByBase.set(base.id, [...(slugsByBase.get(base.id) ?? []), slug])
  }
}

/** Le dossier cible d'une évolution : même suffixe de forme si possible, sinon la forme simple.
 * @param {string} fromSlug
 * @param {string} targetBaseId */
function targetSlug(fromSlug, targetBaseId) {
  const candidates = slugsByBase.get(targetBaseId)
  if (!candidates) return null
  const suffix = species[fromSlug].form
  const sameForm = suffix && candidates.find((slug) => species[slug].form === suffix)
  return sameForm || candidates.find((slug) => !species[slug].form) || candidates[0]
}

/** @type {Record<string, any[]>} */
const evolutions = {}
for (const slug of Object.keys(species)) {
  const from = dex.species.get(species[slug].base)
  const fromLevel = from.evoLevel ?? 0
  const list = []
  for (const evoName of from.evos ?? []) {
    const evo = dex.species.get(evoName)
    if (!evo.exists || evo.num > MAX_DEX || evo.forme) continue
    const to = targetSlug(slug, evo.id)
    if (!to) continue
    /** @type {any} */
    let method
    if (evo.evoType === 'trade') method = { type: 'trade' }
    else if (evo.evoType === 'useItem' && evo.evoItem && STONES[evo.evoItem])
      method = { type: 'stone', item: STONES[evo.evoItem] }
    else if (!evo.evoType && evo.evoLevel) method = { type: 'level', level: evo.evoLevel }
    else if (evo.evoLevel) method = { type: 'level', level: evo.evoLevel }
    // Méthode absente de la V1 (bonheur, lieu, objet tenu, autre pierre…) : niveau de repli, résolu
    // par core/evolution.js à partir de config.js. `baby` : la pré-évolution est apparue après coup.
    else method = { type: 'special', after: fromLevel, ...(from.gen > evo.gen ? { baby: true } : {}) }
    list.push({ to, ...method })
  }
  if (list.length > 0) evolutions[slug] = list
}

const header = (/** @type {string} */ what) =>
  `// Généré par scripts/build-data.mjs. Ne pas éditer à la main.\n// ${what}\n// Sources : @pkmn/dex (Pokémon Showdown, MIT), pokemon (noms FR, MIT), dossiers de jakobhoeg/vscode-pokemon.\n// Données de jeu © Nintendo / Game Freak / The Pokémon Company.\n`
const body = (/** @type {Record<string, unknown>} */ table) =>
  Object.entries(table)
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join('\n')

writeFileSync(
  join(ROOT, 'hooks/data/species.js'),
  `${header('Une entrée par dossier de sprites : numéro de Pokédex, génération, nom FR, stade, famille.')}
/**
 * @typedef {object} Species
 * @property {number} dex numéro de Pokédex national
 * @property {number} gen génération (dossier de sprites)
 * @property {string} name nom français (avec la forme entre parenthèses)
 * @property {string} en nom anglais
 * @property {number} stage stade d'évolution (1 à 3)
 * @property {string} family identifiant de la forme de base de la lignée (pour la rareté)
 * @property {string} base identifiant de l'espèce sans la forme
 * @property {string} [form] suffixe de forme (unown_a → "a")
 */

/** @type {Record<string, Species>} */
export const SPECIES = {
${body(species)}
}
`,
)
writeFileSync(
  join(ROOT, 'hooks/data/evolutions.js'),
  `${header('Évolutions par espèce. Gen 1 recoupée avec dgokcin/claude-pokemon-mod (hooks/evolutions.js).')}
/**
 * @typedef {{ to: string, type: 'level', level: number }
 *   | { to: string, type: 'stone', item: string }
 *   | { to: string, type: 'trade' }
 *   | { to: string, type: 'special', after: number, baby?: boolean }} Evolution
 */

/** @type {Record<string, Evolution[]>} */
export const EVOLUTIONS = {
${body(evolutions)}
}
`,
)
console.log(`${Object.keys(species).length} espèces, ${Object.keys(evolutions).length} avec évolution(s)`)
