import { dexSummaryLines } from '../../commands/dex.js'
import { DEX_PAGE_SIZE, RARITIES } from '../../config.js'
import { rarityOf } from '../../data/rarity.js'
import { SPECIES } from '../../data/species.js'
import { pager, textLines } from './widgets.js'

// Onglet Pokédex : complétion par génération, puis la liste paginée.
// Une espèce jamais rencontrée reste « ??? ».

/**
 * Une ligne par numéro de Pokédex, dans l'ordre : les formes d'une même espèce (Zarbi A à Z,
 * Pikachu ♀…) sont regroupées, la forme simple en tête.
 * @type {{ dex: number, ids: string[] }[]}
 */
const ENTRIES = []
for (const id of Object.keys(SPECIES).sort(
  (a, b) => SPECIES[a].dex - SPECIES[b].dex || Number(Boolean(SPECIES[a].form)) - Number(Boolean(SPECIES[b].form)),
)) {
  const last = ENTRIES.at(-1)
  if (last && last.dex === SPECIES[id].dex) last.ids.push(id)
  else ENTRIES.push({ dex: SPECIES[id].dex, ids: [id] })
}

/**
 * @param {import('./index.js').PaneContext} context
 * @returns {import('../../types.js').UiNode[]}
 */
export function dexTab(context) {
  const { save, view, actions } = context
  const pages = Math.ceil(ENTRIES.length / DEX_PAGE_SIZE)
  const page = Math.min(view.dexPage, pages - 1)
  const lines = ENTRIES.slice(page * DEX_PAGE_SIZE, (page + 1) * DEX_PAGE_SIZE).map(({ dex, ids }) => {
    const number = String(dex).padStart(3, '0')
    let seen = 0
    let caught = 0
    let shiny = 0
    for (const id of ids) {
      seen += save.dex[id]?.seen ?? 0
      caught += save.dex[id]?.caught ?? 0
      shiny += save.dex[id]?.shiny ?? 0
    }
    if (seen === 0 && caught === 0) return `${number} · ???`
    const species = SPECIES[ids[0]]
    const name = ids.length > 1 ? species.name.replace(/ \(.*\)$/, '') : species.name
    const forms =
      ids.length > 1 ? ` · ${ids.filter((id) => (save.dex[id]?.caught ?? 0) > 0).length}/${ids.length} formes` : ''
    return `${number} ${caught > 0 ? '●' : '○'} ${name}${shiny > 0 ? ' ✨' : ''} · ${RARITIES[rarityOf(ids[0])].label}${caught > 1 ? ` ×${caught}` : ''}${forms}`
  })
  return [
    ...textLines(context, dexSummaryLines(save)),
    ...textLines(context, ['', '● capturé  ○ vu  · inconnu'], { dim: true }),
    ...textLines(context, lines),
    ...pager(context, 'dex', page, pages, actions.setDexPage),
  ]
}
