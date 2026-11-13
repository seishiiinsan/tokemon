import { BOOST_DURATIONS } from '../config.js'

// Catalogue des items : noms, catégories, poids de drop et alias de commande.
// Les effets chiffrés (multiplicateurs, durées, XP) sont dans config.js.

/** @typedef {'ball' | 'stone' | 'trade' | 'candy' | 'berry' | 'boost'} ItemKind */

/**
 * @typedef {object} Item
 * @property {string} id
 * @property {string} name nom français affiché
 * @property {ItemKind} kind
 * @property {string} icon glyphe court pour la bande et le panneau
 * @property {number} dropWeight poids dans la table de drop (0 = jamais en drop aléatoire)
 * @property {string} effect description courte
 * @property {string[]} aliases noms acceptés par /tokemon use et /tokemon catch
 */

/** @type {Item[]} */
export const ITEM_LIST = [
  {
    id: 'poke-ball',
    name: 'Poké Ball',
    kind: 'ball',
    icon: '◓',
    dropWeight: 30,
    effect: 'capture ×1',
    aliases: ['poke', 'pokeball'],
  },
  {
    id: 'great-ball',
    name: 'Super Ball',
    kind: 'ball',
    icon: '◓',
    dropWeight: 12,
    effect: 'capture ×1,5',
    aliases: ['super', 'superball', 'great', 'greatball'],
  },
  {
    id: 'ultra-ball',
    name: 'Hyper Ball',
    kind: 'ball',
    icon: '◓',
    dropWeight: 5,
    effect: 'capture ×2',
    aliases: ['hyper', 'hyperball', 'ultra', 'ultraball'],
  },
  {
    id: 'master-ball',
    name: 'Master Ball',
    kind: 'ball',
    icon: '◓',
    dropWeight: 0.2,
    effect: 'capture garantie',
    aliases: ['master', 'masterball'],
  },
  {
    id: 'fire-stone',
    name: 'Pierre Feu',
    kind: 'stone',
    icon: '◆',
    dropWeight: 3,
    effect: 'évolution',
    aliases: ['feu', 'pierrefeu', 'fire', 'firestone'],
  },
  {
    id: 'water-stone',
    name: 'Pierre Eau',
    kind: 'stone',
    icon: '◆',
    dropWeight: 3,
    effect: 'évolution',
    aliases: ['eau', 'pierreeau', 'water', 'waterstone'],
  },
  {
    id: 'thunder-stone',
    name: 'Pierre Foudre',
    kind: 'stone',
    icon: '◆',
    dropWeight: 3,
    effect: 'évolution',
    aliases: ['foudre', 'pierrefoudre', 'thunder', 'thunderstone'],
  },
  {
    id: 'leaf-stone',
    name: 'Pierre Plante',
    kind: 'stone',
    icon: '◆',
    dropWeight: 3,
    effect: 'évolution',
    aliases: ['plante', 'pierreplante', 'leaf', 'leafstone'],
  },
  {
    id: 'moon-stone',
    name: 'Pierre Lune',
    kind: 'stone',
    icon: '◆',
    dropWeight: 3,
    effect: 'évolution',
    aliases: ['lune', 'pierrelune', 'moon', 'moonstone'],
  },
  {
    id: 'link-cable',
    name: 'Link Cable',
    kind: 'trade',
    icon: '∞',
    dropWeight: 2,
    effect: 'évolution par échange',
    aliases: ['cable', 'link', 'linkcable', 'cablelink'],
  },
  {
    id: 'rare-candy',
    name: 'Super Bonbon',
    kind: 'candy',
    icon: '✦',
    dropWeight: 6,
    effect: '+1 niveau',
    aliases: ['bonbon', 'superbonbon', 'candy', 'rarecandy'],
  },
  {
    id: 'oran-berry',
    name: 'Baie Oran',
    kind: 'berry',
    icon: '●',
    dropWeight: 7,
    effect: '+500 XP',
    aliases: ['oran', 'baieoran', 'baie'],
  },
  {
    id: 'sitrus-berry',
    name: 'Baie Sitrus',
    kind: 'berry',
    icon: '●',
    dropWeight: 3,
    effect: '+2 000 XP',
    aliases: ['sitrus', 'baiesitrus'],
  },
  {
    id: 'incense',
    name: 'Encens',
    kind: 'boost',
    icon: '♨',
    dropWeight: 4,
    effect: 'rencontres ×2 pendant 30 min',
    aliases: ['encens'],
  },
  {
    id: 'lucky-egg',
    name: 'Lucky Egg',
    kind: 'boost',
    icon: '◉',
    dropWeight: 3,
    effect: 'XP ×2 pendant 1 h',
    aliases: ['egg', 'luckyegg', 'oeuf', 'oeufchance'],
  },
  {
    id: 'exp-share',
    name: 'Multi Exp',
    kind: 'boost',
    icon: '⇄',
    dropWeight: 2,
    effect: "25 % de l'XP pour toute la box pendant 1 h",
    aliases: ['multi', 'multiexp', 'expshare'],
  },
  {
    id: 'shiny-charm',
    name: 'Charme Chroma',
    kind: 'boost',
    icon: '✧',
    dropWeight: 1,
    effect: 'shiny ×3 pendant 24 h',
    aliases: ['charme', 'charmechroma', 'chroma', 'shinycharm'],
  },
]

/** @type {Record<string, Item>} */
export const ITEMS = Object.fromEntries(ITEM_LIST.map((item) => [item.id, item]))

export const BALL_ORDER = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball']

/** @param {string} text */
export const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9♀♂!?]/g, '')

/**
 * Retrouve un item à partir de ce que la personne a tapé (id, nom ou alias, sans accents ni espaces).
 * @param {string} query
 * @returns {Item | undefined}
 */
export function findItem(query) {
  const wanted = normalize(query)
  if (!wanted) return undefined
  return ITEM_LIST.find(
    (item) => normalize(item.id) === wanted || normalize(item.name) === wanted || item.aliases.includes(wanted),
  )
}

/** @param {string} id */
export const isBoost = (id) => id in BOOST_DURATIONS
