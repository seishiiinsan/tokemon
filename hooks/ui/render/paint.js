import { encodeBase64 } from './base64.js'
import { TRANSPARENT } from './gif.js'

// Dessin : une toile de pixels, puis sa conversion pour la surface.
// - terminal : cellules de Raster, deux pixels par cellule grâce aux demi-blocs
// - desktop (pas de Raster) : un SVG, un chemin par couleur

/** @typedef {import('./frames.js').Bitmap} Bitmap */

const UPPER_HALF = 0x2580
const LOWER_HALF = 0x2584
const SPACE = 0x20
/** Couleur « par défaut du terminal » dans une cellule de Raster */
const DEFAULT_COLOR = 0x01000000
export const WHITE = 0xffffff

/**
 * @param {number} w
 * @param {number} h
 * @returns {Bitmap}
 */
export function createCanvas(w, h) {
  return { w, h, px: new Int32Array(w * h).fill(TRANSPARENT) }
}

/**
 * Réduit une image par échantillonnage au plus proche (factor < 1).
 * @param {Bitmap} image
 * @param {number} factor
 * @returns {Bitmap}
 */
export function scaleBitmap(image, factor) {
  if (factor >= 1) return image
  const w = Math.max(1, Math.round(image.w * factor))
  const h = Math.max(1, Math.round(image.h * factor))
  const out = createCanvas(w, h)
  for (let y = 0; y < h; y++) {
    const sourceY = Math.min(image.h - 1, Math.floor((y + 0.5) / factor))
    for (let x = 0; x < w; x++) {
      out.px[y * w + x] = image.px[sourceY * image.w + Math.min(image.w - 1, Math.floor((x + 0.5) / factor))]
    }
  }
  return out
}

/**
 * Copie une image sur la toile. Les pixels hors de la toile sont ignorés.
 * @param {Bitmap} canvas
 * @param {Bitmap} image
 * @param {number} left
 * @param {number} top
 * @param {{ flip?: boolean, tint?: number }} [options] `flip` : miroir horizontal ; `tint` : silhouette unie
 */
export function drawBitmap(canvas, image, left, top, { flip = false, tint } = {}) {
  for (let y = 0; y < image.h; y++) {
    const targetY = top + y
    if (targetY < 0 || targetY >= canvas.h) continue
    for (let x = 0; x < image.w; x++) {
      const color = image.px[y * image.w + (flip ? image.w - 1 - x : x)]
      const targetX = left + x
      if (color === TRANSPARENT || targetX < 0 || targetX >= canvas.w) continue
      canvas.px[targetY * canvas.w + targetX] = tint ?? color
    }
  }
}

/**
 * Dessine une image décrite par des lignes de caractères et une table de couleurs.
 * @param {Bitmap} canvas
 * @param {string[]} rows
 * @param {Record<string, number>} colors
 * @param {number} left
 * @param {number} top
 */
export function drawPixels(canvas, rows, colors, left, top) {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]]
      const targetX = left + x
      const targetY = top + y
      if (color === undefined || targetX < 0 || targetX >= canvas.w || targetY < 0 || targetY >= canvas.h) continue
      canvas.px[targetY * canvas.w + targetX] = color
    }
  })
}

/** @param {Bitmap} canvas */
export const cellRows = (canvas) => Math.ceil(canvas.h / 2)

/**
 * Convertit la toile en cellules de Raster : base64 de triplets u32 little-endian
 * [caractère, couleur du texte, couleur du fond], deux pixels superposés par cellule.
 * @param {Bitmap} canvas
 * @returns {string}
 */
export function toCells(canvas) {
  const rows = cellRows(canvas)
  const bytes = new Uint8Array(canvas.w * rows * 12)
  const view = new DataView(bytes.buffer)
  let offset = 0
  /** @param {number} glyph @param {number} foreground @param {number} background */
  const put = (glyph, foreground, background) => {
    view.setUint32(offset, glyph, true)
    view.setUint32(offset + 4, foreground, true)
    view.setUint32(offset + 8, background, true)
    offset += 12
  }
  for (let row = 0; row < rows; row++) {
    for (let x = 0; x < canvas.w; x++) {
      const upper = canvas.px[row * 2 * canvas.w + x]
      const lower = row * 2 + 1 < canvas.h ? canvas.px[(row * 2 + 1) * canvas.w + x] : TRANSPARENT
      if (upper === TRANSPARENT && lower === TRANSPARENT) put(SPACE, DEFAULT_COLOR, DEFAULT_COLOR)
      // Une cellule d'une seule couleur est un espace sur ce fond : aucun interstice selon la police
      else if (upper === lower) put(SPACE, DEFAULT_COLOR, upper)
      else if (upper === TRANSPARENT) put(LOWER_HALF, lower, DEFAULT_COLOR)
      else if (lower === TRANSPARENT) put(UPPER_HALF, upper, DEFAULT_COLOR)
      else put(UPPER_HALF, upper, lower)
    }
  }
  return encodeBase64(bytes)
}

/**
 * Convertit la toile en SVG : chaque suite horizontale de pixels d'une même couleur est un
 * rectangle, regroupés en un chemin par couleur.
 * @param {Bitmap} canvas
 * @returns {string}
 */
export function toSvg(canvas) {
  /** @type {Map<number, string>} */
  const paths = new Map()
  for (let y = 0; y < canvas.h; y++) {
    for (let x = 0; x < canvas.w; ) {
      const color = canvas.px[y * canvas.w + x]
      let end = x + 1
      while (end < canvas.w && canvas.px[y * canvas.w + end] === color) end++
      if (color !== TRANSPARENT) paths.set(color, (paths.get(color) ?? '') + `M${x} ${y}h${end - x}v1h${x - end}z`)
      x = end
    }
  }
  let body = ''
  for (const [color, d] of paths) body += `<path fill="#${color.toString(16).padStart(6, '0')}" d="${d}"/>`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" shape-rendering="crispEdges">${body}</svg>`
}
