import { bagSections } from '../../commands/bag.js'
import { formatRemaining } from '../../core/boosts.js'
import { ITEMS } from '../../data/items.js'
import { textLines } from './widgets.js'

// Onglet Sac : l'inventaire par catégorie et les boosts actifs avec leur temps restant.

/**
 * @param {import('./index.js').PaneContext} context
 * @returns {import('../../types.js').UiNode[]}
 */
export function bagTab(context) {
  const { save, now } = context
  const sections = bagSections(save)
  /** @type {import('../../types.js').UiNode[]} */
  const nodes = []
  if (sections.length === 0)
    nodes.push(...textLines(context, ['Ton sac est vide. Les items tombent au fil des tokens.'], { dim: true }))
  for (const section of sections) {
    nodes.push(...textLines(context, [section.title], { bold: true }), ...textLines(context, [...section.lines, '']))
  }
  const active = save.boosts.filter((boost) => boost.expiresAt > now)
  nodes.push(...textLines(context, ['Boosts actifs'], { bold: true }))
  nodes.push(
    ...textLines(
      context,
      active.length > 0
        ? active.map(
            (boost) =>
              `${ITEMS[boost.id]?.icon ?? '•'} ${ITEMS[boost.id]?.name ?? boost.id} · ${ITEMS[boost.id]?.effect ?? ''} · reste ${formatRemaining(boost.expiresAt - now)}`,
          )
        : ['Aucun. /tokemon use <item> pour en activer un.'],
      { dim: active.length === 0 },
    ),
  )
  nodes.push(...textLines(context, ['', '/tokemon use <item> [mon] · /tokemon catch [ball]'], { dim: true }))
  return nodes
}
