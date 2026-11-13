import { SPRITE_ANIMS, SPRITE_VARIANTS } from '../../config.js'
import { TRANSPARENT } from './gif.js'

// Format compact des sprites (celui de hooks/data/frames.gen1.js et du cache des gens 2 à 5)
// et registre des sprites disponibles en local.

/** @typedef {'default' | 'shiny'} Variant */
/** @typedef {'idle' | 'walk'} Anim */

/**
 * Une image d'animation : `w × h` caractères, un par pixel. '.' est transparent,
 * les autres caractères sont un index dans la palette de la variante (voir PALETTE_CHARS).
 * @typedef {{ ms: number, px: string }} SpriteFrame
 */

/**
 * @typedef {object} SpriteSheet
 * @property {string[]} palette couleurs en hexadécimal sans '#'
 * @property {SpriteFrame[]} idle
 * @property {SpriteFrame[]} walk
 */

/**
 * @typedef {object} Sprite
 * @property {number} w
 * @property {number} h
 * @property {{ default: SpriteSheet, shiny?: SpriteSheet }} variants la variante shiny manque pour certains mons (gen 5)
 */

/** Image prête à dessiner. @typedef {{ w: number, h: number, px: Int32Array }} Bitmap */

export const PALETTE_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** @type {Map<string, Sprite>} */
const REGISTRY = new Map()

/** @param {Record<string, Sprite>} table */
export function registerSprites(table) {
  for (const [id, sprite] of Object.entries(table)) REGISTRY.set(id, sprite)
}

/** @param {string} id */
export const hasSprite = (id) => REGISTRY.has(id)
/** @param {string} id */
export const getSprite = (id) => REGISTRY.get(id)
export const spriteIds = () => [...REGISTRY.keys()]

/**
 * L'image à afficher à l'instant `elapsedMs` d'une animation jouée en boucle.
 * @param {SpriteFrame[]} frames
 * @param {number} elapsedMs
 * @returns {SpriteFrame}
 */
export function frameAt(frames, elapsedMs) {
  let total = 0
  for (const frame of frames) total += frame.ms
  let rest = total > 0 ? elapsedMs % total : 0
  for (const frame of frames) {
    if (rest < frame.ms) return frame
    rest -= frame.ms
  }
  return frames[frames.length - 1]
}

/** @type {WeakMap<SpriteFrame, Bitmap>} */
const BITMAPS = new WeakMap()

/**
 * @param {Sprite} sprite
 * @param {Variant} variant
 * @param {SpriteFrame} frame
 * @returns {Bitmap}
 */
export function bitmapOf(sprite, variant, frame) {
  const cached = BITMAPS.get(frame)
  if (cached) return cached
  const colors = (sprite.variants[variant] ?? sprite.variants.default).palette.map((hex) => Number.parseInt(hex, 16))
  const px = new Int32Array(sprite.w * sprite.h)
  for (let i = 0; i < px.length; i++) {
    const char = frame.px[i]
    px[i] = char === '.' || char === undefined ? TRANSPARENT : (colors[PALETTE_CHARS.indexOf(char)] ?? TRANSPARENT)
  }
  const bitmap = { w: sprite.w, h: sprite.h, px }
  BITMAPS.set(frame, bitmap)
  return bitmap
}

/**
 * L'image courante d'un mon, prête à dessiner. Sans animation de marche, l'attente la remplace.
 * @param {string} speciesId
 * @param {Variant} variant
 * @param {Anim} anim
 * @param {number} elapsedMs
 * @returns {Bitmap | undefined}
 */
export function spriteBitmap(speciesId, variant, anim, elapsedMs) {
  const sprite = REGISTRY.get(speciesId)
  if (!sprite) return undefined
  const sheet = sprite.variants[variant] ?? sprite.variants.default
  const frames = sheet[anim]?.length ? sheet[anim] : sheet.idle
  return bitmapOf(sprite, sprite.variants[variant] ? variant : 'default', frameAt(frames, elapsedMs))
}

/** @param {number} a @param {number} b */
function colorDistance(a, b) {
  const dr = (a >> 16) - (b >> 16)
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255)
  const db = (a & 255) - (b & 255)
  return dr * dr + dg * dg + db * db
}

/**
 * Construit un sprite compact à partir des GIF décodés d'un mon : recadré sur la boîte
 * englobante commune à toutes ses images, une palette par variante.
 * @param {{ default: Record<Anim, import('./gif.js').Gif>, shiny?: Record<Anim, import('./gif.js').Gif> }} sheets sans `shiny`, le sprite n'a que sa variante normale
 * @returns {Sprite}
 */
export function buildSprite(sheets) {
  const { width, height } = sheets.default.idle
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  const variants = SPRITE_VARIANTS.filter((variant) => sheets[variant] !== undefined)
  for (const variant of variants) {
    for (const anim of SPRITE_ANIMS) {
      const gif = /** @type {Record<Anim, import('./gif.js').Gif>} */ (sheets[variant])[anim]
      if (gif.width !== width || gif.height !== height) throw new Error('Les GIF du sprite ont des tailles différentes')
      for (const { px } of gif.frames) {
        for (let i = 0; i < px.length; i++) {
          if (px[i] === TRANSPARENT) continue
          const x = i % width
          const y = (i - x) / width
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }
  if (maxX < 0) throw new Error('Sprite vide')

  /** @type {Sprite} */
  const sprite = { w: maxX - minX + 1, h: maxY - minY + 1, variants: /** @type {any} */ ({}) }
  for (const variant of variants) {
    const sheet = /** @type {Record<Anim, import('./gif.js').Gif>} */ (sheets[variant])
    /** @type {number[]} */
    const colors = []
    /** @param {number} color */
    const charOf = (color) => {
      if (color === TRANSPARENT) return '.'
      let index = colors.indexOf(color)
      if (index < 0 && colors.length < PALETTE_CHARS.length) index = colors.push(color) - 1
      if (index < 0) {
        // Palette pleine : la couleur déjà connue la plus proche
        index = 0
        for (let i = 1; i < colors.length; i++)
          if (colorDistance(colors[i], color) < colorDistance(colors[index], color)) index = i
      }
      return PALETTE_CHARS[index]
    }
    /** @param {import('./gif.js').Gif} gif */
    const pack = (gif) =>
      gif.frames.map(({ ms, px }) => {
        let text = ''
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) text += charOf(px[y * width + x])
        return { ms, px: text }
      })
    const idle = pack(sheet.idle)
    const walk = pack(sheet.walk)
    sprite.variants[variant] = { palette: colors.map((color) => color.toString(16).padStart(6, '0')), idle, walk }
  }
  return sprite
}
