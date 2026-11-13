import { BOX_PAGE_SIZE, DESKTOP_PIXEL_PX } from '../../config.js'
import { activeMon, monName } from '../../core/context.js'
import { describeMethod, evolutionsOf } from '../../core/evolution.js'
import { variantOf } from '../../core/team.js'
import { speciesName } from '../../data/lookup.js'
import { hasSprite, spriteBitmap } from '../render/frames.js'
import { cellRows, toCells, toSvg } from '../render/paint.js'
import { monTitle, xpLine } from '../text.js'
import { pager } from './widgets.js'

// Onglet Équipe : le compagnon (sprite, niveau, XP, prochaine évolution) et la box.
// Chaque mon de la box est un bouton : un appui le rend actif.

/**
 * Le sprite du compagnon, immobile (la bande porte l'animation).
 * @param {import('./index.js').PaneContext} context
 * @param {import('../../store/schema.js').Mon} mon
 */
function portrait({ elements, e }, mon) {
  const image = spriteBitmap(mon.species, variantOf(mon), 'idle', 0)
  if (!image) return null
  if (e.surface === 'terminal' && elements.Raster) {
    return elements.Raster({ key: 'tokemon-pane-mon', columns: image.w, rows: cellRows(image), cells: toCells(image) })
  }
  if (elements.Svg) {
    return elements.Svg({
      source: toSvg(image),
      alt: monName(mon),
      width: image.w * DESKTOP_PIXEL_PX,
      height: image.h * DESKTOP_PIXEL_PX,
    })
  }
  return null
}

/**
 * @param {import('./index.js').PaneContext} context
 * @returns {import('../../types.js').UiNode[]}
 */
export function teamTab(context) {
  const { elements, save, view, actions } = context
  const { Box, Text, Button } = elements
  if (!Box || !Text) return []
  const mon = activeMon(save)
  if (!mon) return [Text({ children: ['Pas encore de compagnon. Choisis ton starter : /tokemon start <mon>'] })]

  const next = evolutionsOf(mon.species, { rng: () => 0, now: context.now, available: hasSprite })
  const details = [
    Text({ bold: true, children: [monTitle(mon)] }),
    ...(mon.nickname ? [Text({ dimColor: true, children: [speciesName(mon.species)] })] : []),
    Text({ children: [xpLine(mon)] }),
    Text({
      dimColor: true,
      children: [
        next.length > 0
          ? 'Évolution : ' +
            next.map((evolution) => `${speciesName(evolution.to)} (${describeMethod(evolution)})`).join(', ')
          : 'Pas d’évolution disponible',
      ],
    }),
  ]
  const image = portrait(context, mon)
  /** @type {import('../../types.js').UiNode[]} */
  const nodes = [
    Box({
      flexDirection: 'row',
      children: [
        ...(image ? [image] : []),
        Box({ flexDirection: 'column', paddingLeft: image ? 1 : 0, children: details }),
      ],
    }),
    Text({ children: [' '] }),
    Text({ bold: true, children: [`Box (${save.box.length})`] }),
  ]

  const pages = Math.max(1, Math.ceil(save.box.length / BOX_PAGE_SIZE))
  const page = Math.min(view.boxPage, pages - 1)
  save.box.slice(page * BOX_PAGE_SIZE, (page + 1) * BOX_PAGE_SIZE).forEach((entry, offset) => {
    const index = page * BOX_PAGE_SIZE + offset
    const species = speciesName(entry.species)
    const label = `#${index + 1} ${entry.nickname ? `${entry.nickname} (${species})` : species} · niv. ${entry.level}${entry.shiny ? ' ✨' : ''}`
    if (entry.id === mon.id || !Button) nodes.push(Text({ color: 'success', children: [`▶ ${label}`] }))
    else
      nodes.push(
        Button({ key: 'mon-' + entry.id, plain: true, label: `  ${label}`, onPress: () => actions.switchTo(entry.id) }),
      )
  })
  nodes.push(...pager(context, 'box', page, pages, actions.setBoxPage))
  return nodes
}
