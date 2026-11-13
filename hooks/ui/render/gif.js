// Décodeur GIF89a minimal (écrit pour Tokemon) : assez pour les sprites animés 8 fps.
// Gère la table de couleurs globale et locale, la transparence, les modes de disposal,
// l'entrelacement et les délais. Chaque image rendue est la toile complète composée.

/** Pixel transparent dans les tableaux de pixels (les couleurs sont des 0xRRGGBB) */
export const TRANSPARENT = -1

/**
 * @typedef {object} GifFrame
 * @property {number} ms durée d'affichage
 * @property {Int32Array} px toile complète, ligne par ligne : 0xRRGGBB ou TRANSPARENT
 */

/**
 * @typedef {object} Gif
 * @property {number} width
 * @property {number} height
 * @property {GifFrame[]} frames
 */

const MAX_CODES = 4096

/**
 * Décompression LZW variante GIF (codes de taille variable, bits de poids faible d'abord).
 * @param {number} minCodeSize
 * @param {Uint8Array} data les sous-blocs de données concaténés
 * @param {number} pixelCount
 * @returns {Uint8Array} un index de palette par pixel
 */
export function unpackLzw(minCodeSize, data, pixelCount) {
  const clearCode = 1 << minCodeSize
  const endCode = clearCode + 1
  // Chaque code est une chaîne : son préfixe (un autre code), son dernier index, son premier
  // index et sa longueur. On écrit une chaîne en remontant ses préfixes depuis la fin.
  const prefix = new Uint16Array(MAX_CODES)
  const last = new Uint8Array(MAX_CODES)
  const first = new Uint8Array(MAX_CODES)
  const lengths = new Uint16Array(MAX_CODES)
  for (let code = 0; code < clearCode; code++) {
    last[code] = code
    first[code] = code
    lengths[code] = 1
  }
  const out = new Uint8Array(pixelCount)
  let written = 0
  let codeSize = minCodeSize + 1
  let nextCode = endCode + 1
  let previous = -1
  let buffer = 0
  let bitCount = 0

  for (let i = 0; i < data.length; i++) {
    buffer |= data[i] << bitCount
    bitCount += 8
    while (bitCount >= codeSize) {
      const code = buffer & ((1 << codeSize) - 1)
      buffer >>>= codeSize
      bitCount -= codeSize

      if (code === clearCode) {
        codeSize = minCodeSize + 1
        nextCode = endCode + 1
        previous = -1
        continue
      }
      if (code === endCode || code > nextCode) return out
      if (previous >= 0 && nextCode < MAX_CODES) {
        // Nouvelle entrée : la chaîne précédente + le premier index de la chaîne courante
        // (qui est la précédente elle-même quand le code n'existe pas encore).
        prefix[nextCode] = previous
        last[nextCode] = first[code === nextCode ? previous : code]
        first[nextCode] = first[previous]
        lengths[nextCode] = lengths[previous] + 1
        nextCode++
        if (nextCode === 1 << codeSize && codeSize < 12) codeSize++
      } else if (previous >= 0 && code >= nextCode) {
        return out
      }
      const length = lengths[code]
      let cursor = code
      for (let k = length - 1; k >= 0; k--) {
        if (written + k < pixelCount) out[written + k] = last[cursor]
        cursor = prefix[cursor]
      }
      written += length
      if (written >= pixelCount) return out
      previous = code
    }
  }
  return out
}

/**
 * Ordre des lignes d'une image entrelacée (4 passes).
 * @param {number} height
 * @returns {number[]}
 */
function interlacedOrder(height) {
  /** @type {number[]} */
  const order = []
  for (const [start, step] of [
    [0, 8],
    [4, 8],
    [2, 4],
    [1, 2],
  ]) {
    for (let y = start; y < height; y += step) order.push(y)
  }
  return order
}

/**
 * @param {Uint8Array} bytes contenu du fichier GIF
 * @returns {Gif}
 */
export function decodeGif(bytes) {
  if (bytes.length < 13 || bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46)
    throw new Error("Ce n'est pas un GIF")
  const word = (/** @type {number} */ at) => bytes[at] | (bytes[at + 1] << 8)
  const width = word(6)
  const height = word(8)
  let at = 13

  /** @param {number} size */
  const readPalette = (size) => {
    const palette = new Int32Array(size)
    for (let i = 0; i < size; i++, at += 3) palette[i] = (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2]
    return palette
  }
  /** Lit une suite de sous-blocs et renvoie leurs données concaténées */
  const readSubBlocks = () => {
    const start = at
    let total = 0
    while (at < bytes.length && bytes[at] !== 0) {
      total += bytes[at]
      at += bytes[at] + 1
    }
    const end = at
    at++
    const data = new Uint8Array(total)
    let offset = 0
    for (let cursor = start; cursor < end; cursor += bytes[cursor] + 1) {
      data.set(bytes.subarray(cursor + 1, cursor + 1 + bytes[cursor]), offset)
      offset += bytes[cursor]
    }
    return data
  }

  const globalPalette = bytes[10] & 0x80 ? readPalette(2 << (bytes[10] & 7)) : new Int32Array(0)
  let canvas = new Int32Array(width * height).fill(TRANSPARENT)
  let delay = 0
  let transparentIndex = -1
  let disposal = 0
  /** @type {GifFrame[]} */
  const frames = []

  while (at < bytes.length) {
    const marker = bytes[at++]
    if (marker === 0x3b) break
    if (marker === 0x21) {
      const label = bytes[at++]
      if (label === 0xf9 && bytes[at] === 4) {
        const flags = bytes[at + 1]
        delay = word(at + 2)
        transparentIndex = flags & 1 ? bytes[at + 4] : -1
        disposal = (flags >> 2) & 7
      }
      readSubBlocks()
      continue
    }
    if (marker !== 0x2c) break

    const left = word(at)
    const top = word(at + 2)
    const frameWidth = word(at + 4)
    const frameHeight = word(at + 6)
    const flags = bytes[at + 8]
    at += 9
    const palette = flags & 0x80 ? readPalette(2 << (flags & 7)) : globalPalette
    const minCodeSize = bytes[at++]
    const indices = unpackLzw(minCodeSize, readSubBlocks(), frameWidth * frameHeight)
    const rows = flags & 0x40 ? interlacedOrder(frameHeight) : null
    const restore = disposal === 3 ? canvas.slice() : null

    for (let row = 0; row < frameHeight; row++) {
      const y = top + (rows ? rows[row] : row)
      if (y >= height) continue
      for (let column = 0; column < frameWidth; column++) {
        const x = left + column
        const index = indices[row * frameWidth + column]
        if (x < width && index !== transparentIndex && index < palette.length) canvas[y * width + x] = palette[index]
      }
    }
    // Les GIF sans délai (ou à 10 ms) sont affichés à 100 ms par les navigateurs
    frames.push({ ms: delay < 2 ? 100 : delay * 10, px: canvas.slice() })

    if (disposal === 2) {
      for (let y = top; y < Math.min(top + frameHeight, height); y++) {
        canvas.fill(TRANSPARENT, y * width + left, y * width + Math.min(left + frameWidth, width))
      }
    } else if (restore) {
      canvas = restore
    }
    delay = 0
    transparentIndex = -1
    disposal = 0
  }
  if (frames.length === 0) throw new Error('GIF sans image')
  return { width, height, frames }
}
