import { BAND_MAX_ROWS, BAND_SCENE_COLUMNS, BAND_TEXT_MIN_COLUMNS, DESKTOP_PIXEL_PX, STARTERS } from '../config.js'
import { activeMon } from '../core/context.js'
import { compactNumber } from '../core/stats.js'
import { variantOf } from '../core/team.js'
import { speciesName } from '../data/lookup.js'
import { hasSprite } from './render/frames.js'
import { cellRows, toCells, toSvg } from './render/paint.js'
import { composeScene } from './scene.js'
import { boostsLine, monTitle, wildLine, xpLine } from './text.js'

// La bande au-dessus du prompt : la scène animée à gauche, le texte à droite.
// Terminal : un Raster (repeint ensuite par $.ui.blit). Desktop et autres : un Svg.
// Si la place ou les sprites manquent, la bande se replie sur du texte seul.

/** @typedef {import('../store/schema.js').Save} Save */

export const RASTER_KEY = 'tokemon-scene'

/**
 * Dimensions de la scène pour la place disponible, ou null s'il n'y a pas la place de la dessiner.
 * @param {import('../types.js').RenderEvent} e
 * @returns {{ columns: number, rows: number } | null}
 */
export function sceneSize(e) {
  const bodyColumns = Number(e.props.bodyColumns ?? e.viewport?.columns ?? 80)
  const maxRows = Number(e.props.maxRows ?? BAND_MAX_ROWS)
  const columns = Math.min(BAND_SCENE_COLUMNS, bodyColumns - BAND_TEXT_MIN_COLUMNS)
  const rows = Math.min(BAND_MAX_ROWS, maxRows)
  return columns >= 16 && rows >= 3 ? { columns, rows } : null
}

/**
 * Ce que la scène doit montrer, d'après la sauvegarde.
 * @param {Save} save
 * @param {import('./scene.js').Scene} scene
 * @param {{ columns: number, rows: number }} size
 * @returns {import('./scene.js').SceneView}
 */
export function sceneView(save, scene, size) {
  const mon = activeMon(save)
  const wild = save.state.wild
  return {
    ...size,
    active: mon && hasSprite(mon.species) ? { species: mon.species, variant: variantOf(mon) } : null,
    wild: wild && hasSprite(wild.species) ? { species: wild.species, shiny: wild.shiny } : null,
    evolving: save.state.pendingEvolution !== null,
    scene,
  }
}

/**
 * Les lignes de texte de la bande.
 * @param {Save} save
 * @param {number} now
 * @returns {{ text: string, dim?: boolean, bold?: boolean, color?: string }[]}
 */
export function bandLines(save, now) {
  const mon = activeMon(save)
  if (!mon) {
    return [
      { text: 'Tokemon · choisis ton starter', bold: true },
      { text: STARTERS.map((id) => speciesName(id)).join(' · ') },
      { text: `/tokemon start ${speciesName(STARTERS[0]).toLowerCase()}`, dim: true },
    ]
  }
  const { totals, wild, pendingEvolution } = save.state
  /** @type {{ text: string, dim?: boolean, bold?: boolean, color?: string }[]} */
  const lines = [{ text: monTitle(mon), bold: true }, { text: xpLine(mon) }]
  const boosts = boostsLine(save, now)
  if (boosts) lines.push({ text: boosts, color: 'warning' })
  if (pendingEvolution)
    lines.push({
      text: `Évolution en ${speciesName(pendingEvolution.to)}… /tokemon stop pour annuler`,
      color: 'success',
    })
  if (wild) lines.push({ text: wildLine(wild, now), color: 'warning' })
  lines.push({
    text: `${totals.approximateTokens > 0 ? '≈ ' : ''}${compactNumber(totals.outputTokens)} tokens au total`,
    dim: true,
  })
  return lines
}

/**
 * @param {string} text
 * @returns {string} une empreinte courte (djb2)
 */
function hashText(text) {
  let hash = 5381
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0
  return (hash >>> 0).toString(36)
}

/**
 * Dessine la bande.
 * @param {import('../types.js').UiElements} elements
 * @param {import('../types.js').RenderEvent} e
 * @param {{ save: Save, scene: import('./scene.js').Scene, now: number }} model
 * @returns {{ node: import('../types.js').UiNode, columns: number, rows: number, cells: string | null, svg: string | null }}
 */
export function renderBand(elements, e, model) {
  const { Box, Text, Raster, Svg } = elements
  if (!Box || !Text) throw new Error('La surface ne fournit ni Box ni Text')
  const text = Box({
    flexDirection: 'column',
    paddingLeft: 1,
    children: bandLines(model.save, model.now).map((line) =>
      Text({ bold: line.bold, dimColor: line.dim, color: line.color, wrap: 'truncate-end', children: [line.text] }),
    ),
  })

  const size = sceneSize(e)
  const view = size && sceneView(model.save, model.scene, size)
  if (!size || !view || (!view.active && !view.wild))
    return { node: Box({ flexDirection: 'row', children: [text] }), columns: 0, rows: 0, cells: null, svg: null }

  const canvas = composeScene(view)
  if (e.surface === 'terminal' && Raster) {
    const cells = toCells(canvas)
    const raster = Raster({ key: RASTER_KEY, columns: canvas.w, rows: cellRows(canvas), cells })
    return {
      node: Box({ flexDirection: 'row', children: [raster, text] }),
      columns: canvas.w,
      rows: cellRows(canvas),
      cells,
      svg: null,
    }
  }
  if (Svg) {
    const svg = toSvg(canvas)
    const image = Svg({
      source: svg,
      alt: 'Tokemon',
      width: canvas.w * DESKTOP_PIXEL_PX,
      height: canvas.h * DESKTOP_PIXEL_PX,
    })
    // Le desktop garde la première image d'un Svg tant que sa place dans l'arbre ne change pas :
    // la clé change donc avec l'image.
    const frame = Box({ key: 'tokemon-scene-' + hashText(svg), flexShrink: 0, children: [image] })
    return {
      node: Box({ flexDirection: 'row', children: [frame, text] }),
      columns: canvas.w,
      rows: cellRows(canvas),
      cells: null,
      svg,
    }
  }
  return { node: Box({ flexDirection: 'row', children: [text] }), columns: 0, rows: 0, cells: null, svg: null }
}
