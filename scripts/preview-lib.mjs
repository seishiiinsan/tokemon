// Outils des scripts de preview : affichage d'un Raster dans le terminal (ANSI 24 bits)
// et mise à plat d'un arbre rendu en lignes de texte.

import { decodeBase64 } from '../hooks/ui/render/base64.js'

const DEFAULT_COLOR = 0x01000000

/** @param {number} color @param {boolean} background */
const ansi = (color, background) =>
  color === DEFAULT_COLOR
    ? background
      ? '\x1b[49m'
      : '\x1b[39m'
    : `\x1b[${background ? 48 : 38};2;${color >> 16};${(color >> 8) & 255};${color & 255}m`

/**
 * @param {string} cells cellules d'un Raster (base64)
 * @param {number} columns
 * @returns {string[]} une ligne de terminal par rangée, avec ses couleurs
 */
export function cellsToAnsi(cells, columns) {
  const words = new Uint32Array(decodeBase64(cells).slice().buffer)
  /** @type {string[]} */
  const lines = []
  for (let i = 0; i < words.length; i += columns * 3) {
    let line = ''
    for (let x = 0; x < columns; x++) {
      const at = i + x * 3
      line += ansi(words[at + 1], false) + ansi(words[at + 2], true) + String.fromCodePoint(words[at])
    }
    lines.push(line + '\x1b[0m')
  }
  return lines
}

/**
 * Met à plat un arbre rendu par le stub : une ligne par Text ou Button, la scène en couleurs.
 * @param {any} node
 * @param {string[]} [out]
 * @returns {string[]}
 */
export function treeToLines(node, out = []) {
  if (!node || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    for (const child of node) treeToLines(child, out)
    return out
  }
  if (node.type === 'Raster') out.push(...cellsToAnsi(node.props.cells, node.props.columns))
  else if (node.type === 'Svg')
    out.push(`[Svg ${node.props.width}×${node.props.height} px, ${node.props.source.length} caractères]`)
  else if (node.type === 'Text') out.push((node.props.children ?? []).join(''))
  else if (node.type === 'Button') out.push(`[ ${node.props.label ?? (node.props.children ?? []).join('')} ]`)
  else if (node.type === 'Progress') out.push(`${node.props.label} ${Math.round((node.props.value ?? 0) * 100)} %`)
  else treeToLines(node.props?.children, out)
  return out
}
