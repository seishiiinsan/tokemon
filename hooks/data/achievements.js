// Les succès de la V1 : libellés et récompenses. Les conditions sont dans core/achievements.js.

/**
 * @typedef {object} Achievement
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ item: string, count: number }} reward
 */

/** @type {Achievement[]} */
export const ACHIEVEMENT_LIST = [
  {
    id: 'first-catch',
    name: 'Premier pas',
    description: 'Capturer un premier Pokémon',
    reward: { item: 'poke-ball', count: 5 },
  },
  {
    id: 'catch-10',
    name: 'Collectionneur',
    description: '10 Pokémon capturés',
    reward: { item: 'great-ball', count: 5 },
  },
  { id: 'catch-50', name: 'Chasseur', description: '50 Pokémon capturés', reward: { item: 'ultra-ball', count: 5 } },
  {
    id: 'catch-151',
    name: 'Maître Pokémon',
    description: '151 Pokémon capturés',
    reward: { item: 'master-ball', count: 1 },
  },
  {
    id: 'dex-25',
    name: 'Pokédex en herbe',
    description: '25 espèces différentes capturées',
    reward: { item: 'incense', count: 1 },
  },
  {
    id: 'dex-100',
    name: 'Pokédex bien rempli',
    description: '100 espèces différentes capturées',
    reward: { item: 'shiny-charm', count: 1 },
  },
  {
    id: 'first-shiny',
    name: 'Ça brille !',
    description: 'Capturer un premier shiny',
    reward: { item: 'lucky-egg', count: 1 },
  },
  {
    id: 'first-legendary',
    name: 'Légende vivante',
    description: 'Capturer un légendaire',
    reward: { item: 'master-ball', count: 1 },
  },
  { id: 'tokens-100k', name: 'Bavard', description: '100 000 output tokens', reward: { item: 'rare-candy', count: 1 } },
  {
    id: 'tokens-1m',
    name: 'Moulin à paroles',
    description: '1 000 000 output tokens',
    reward: { item: 'rare-candy', count: 3 },
  },
  {
    id: 'tokens-10m',
    name: 'Intarissable',
    description: '10 000 000 output tokens',
    reward: { item: 'master-ball', count: 1 },
  },
  {
    id: 'first-evolution',
    name: 'Métamorphose',
    description: 'Une première évolution',
    reward: { item: 'oran-berry', count: 3 },
  },
  {
    id: 'stone-evolution',
    name: 'Pierre précieuse',
    description: 'Une évolution par pierre',
    reward: { item: 'link-cable', count: 1 },
  },
  {
    id: 'trade-evolution',
    name: 'Bien câblé',
    description: 'Une évolution par Link Cable',
    reward: { item: 'moon-stone', count: 1 },
  },
  {
    id: 'level-50',
    name: 'Mi-parcours',
    description: 'Un Pokémon au niveau 50',
    reward: { item: 'sitrus-berry', count: 2 },
  },
  {
    id: 'level-100',
    name: 'Au sommet',
    description: 'Un Pokémon au niveau 100',
    reward: { item: 'master-ball', count: 1 },
  },
  {
    id: 'streak-7',
    name: 'Assidu',
    description: "7 jours d'affilée avec une session",
    reward: { item: 'lucky-egg', count: 1 },
  },
  {
    id: 'master-ball-used',
    name: 'Sans filet',
    description: 'Utiliser une Master Ball',
    reward: { item: 'ultra-ball', count: 3 },
  },
  { id: 'items-25', name: 'Ramasse-tout', description: '25 items trouvés', reward: { item: 'exp-share', count: 1 } },
  {
    id: 'eevee-evolution',
    name: "L'embarras du choix",
    description: 'Faire évoluer Évoli',
    reward: { item: 'water-stone', count: 1 },
  },
]

/** @type {Record<string, Achievement>} */
export const ACHIEVEMENTS = Object.fromEntries(ACHIEVEMENT_LIST.map((achievement) => [achievement.id, achievement]))
