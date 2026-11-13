import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { GEN1_SPRITES } from '../../hooks/data/frames.gen1.js'
import { decodeBase64, encodeBase64 } from '../../hooks/ui/render/base64.js'
import {
  bitmapOf,
  buildSprite,
  frameAt,
  getSprite,
  hasSprite,
  registerSprites,
  spriteBitmap,
  spriteIds,
} from '../../hooks/ui/render/frames.js'
import { decodeGif, TRANSPARENT, unpackLzw } from '../../hooks/ui/render/gif.js'
import {
  cellRows,
  createCanvas,
  drawBitmap,
  drawPixels,
  scaleBitmap,
  toCells,
  toSvg,
  WHITE,
} from '../../hooks/ui/render/paint.js'

const gif = (/** @type {string} */ mon, /** @type {string} */ file) =>
  decodeGif(new Uint8Array(readFileSync(new URL(`../../sprites/${mon}/${file}_8fps.gif`, import.meta.url))))

test('base64 : aller-retour, padding, retours à la ligne ignorés', () => {
  for (const length of [0, 1, 2, 3, 4, 255, 30_000]) {
    const bytes = Uint8Array.from({ length }, (_, i) => (i * 37) & 255)
    const text = encodeBase64(bytes)
    assert.equal(text, Buffer.from(bytes).toString('base64'))
    assert.deepEqual(decodeBase64(text), bytes)
  }
  assert.deepEqual([...decodeBase64('SGVs\nbG8=\n')], [...Buffer.from('Hello')])
})

test('GIF : dimensions, images et durées des sprites embarqués', () => {
  const idle = gif('bulbasaur', 'default_idle')
  assert.equal(idle.width, 32)
  assert.equal(idle.height, 32)
  assert.ok(idle.frames.length >= 2)
  for (const frame of idle.frames) {
    assert.equal(frame.px.length, 32 * 32)
    assert.ok(frame.ms >= 20)
    assert.ok(frame.px.some((color) => color !== TRANSPARENT))
    assert.ok(frame.px.some((color) => color === TRANSPARENT))
  }
})

test('GIF : fichier invalide refusé', () => {
  assert.throws(() => decodeGif(new Uint8Array([1, 2, 3])), /GIF/)
  assert.throws(() => decodeGif(new Uint8Array(20)), /GIF/)
})

test('LZW : flux minimal (code clear, 4 index, code fin)', () => {
  // minCodeSize 2 : clear = 4, fin = 5. Les codes passent de 3 à 4 bits quand la table atteint 8 entrées.
  const codes = [
    [4, 3],
    [1, 3],
    [0, 3],
    [1, 3],
    [0, 4],
    [5, 4],
  ]
  let bits = 0n
  let offset = 0n
  for (const [code, size] of codes) {
    bits |= BigInt(code) << offset
    offset += BigInt(size)
  }
  const data = Uint8Array.from({ length: 3 }, (_, i) => Number((bits >> BigInt(i * 8)) & 0xffn))
  assert.deepEqual([...unpackLzw(2, data, 4)], [1, 0, 1, 0])
  assert.deepEqual([...unpackLzw(2, data.subarray(0, 1), 4)], [1, 0, 0, 0], 'flux tronqué : le reste est à zéro')
})

test('buildSprite : recadrage commun, palette par variante, identique au fichier généré', () => {
  const sheets = {
    default: { idle: gif('pikachu', 'default_idle'), walk: gif('pikachu', 'default_walk') },
    shiny: { idle: gif('pikachu', 'shiny_idle'), walk: gif('pikachu', 'shiny_walk') },
  }
  const sprite = buildSprite(sheets)
  assert.deepEqual(sprite, GEN1_SPRITES.pikachu)
  assert.ok(sprite.w < 32 && sprite.h < 32)
  assert.notDeepEqual(sprite.variants.default.palette, sprite.variants.shiny.palette)
  for (const frame of sprite.variants.default.idle) assert.equal(frame.px.length, sprite.w * sprite.h)
})

test('registre de sprites et image courante', () => {
  assert.equal(hasSprite('pikachu-test'), false)
  registerSprites({ 'pikachu-test': GEN1_SPRITES.pikachu })
  assert.equal(hasSprite('pikachu-test'), true)
  assert.ok(spriteIds().includes('pikachu-test'))
  const sprite = getSprite('pikachu-test')
  assert.ok(sprite)
  const frames = sprite.variants.default.walk
  assert.equal(frameAt(frames, 0), frames[0])
  assert.equal(frameAt(frames, frames[0].ms), frames[1])
  const total = frames.reduce((sum, frame) => sum + frame.ms, 0)
  assert.equal(frameAt(frames, total + 1), frames[0], 'boucle')
  const bitmap = bitmapOf(sprite, 'default', frames[0])
  assert.equal(bitmapOf(sprite, 'default', frames[0]), bitmap, 'mis en cache')
  assert.equal(bitmap.px.length, sprite.w * sprite.h)
  assert.ok(spriteBitmap('pikachu-test', 'shiny', 'idle', 0))
  assert.equal(spriteBitmap('absent', 'default', 'idle', 0), undefined)
})

test('dessin : miroir, silhouette, hors-cadre, réduction', () => {
  const image = { w: 2, h: 1, px: Int32Array.of(0xff0000, TRANSPARENT) }
  const canvas = createCanvas(3, 2)
  drawBitmap(canvas, image, 0, 0)
  assert.deepEqual([...canvas.px], [0xff0000, -1, -1, -1, -1, -1])
  drawBitmap(canvas, image, 1, 1, { flip: true })
  assert.equal(canvas.px[5], 0xff0000)
  drawBitmap(canvas, image, 0, 0, { tint: WHITE })
  assert.equal(canvas.px[0], WHITE)
  drawBitmap(canvas, image, -5, 9)
  drawPixels(canvas, ['a.', '.a'], { a: 0x00ff00 }, 2, 0)
  assert.equal(canvas.px[2], 0x00ff00)
  const big = { w: 4, h: 4, px: new Int32Array(16).fill(0x123456) }
  assert.equal(scaleBitmap(big, 1), big)
  const small = scaleBitmap(big, 0.5)
  assert.deepEqual([small.w, small.h, small.px[0]], [2, 2, 0x123456])
})

test('toCells : demi-blocs, 3 mots u32 par cellule', () => {
  const canvas = createCanvas(4, 3)
  canvas.px.set([0xff0000, 0xff0000, TRANSPARENT, TRANSPARENT], 0)
  canvas.px.set([0xff0000, 0x0000ff, 0x00ff00, TRANSPARENT], 4)
  const words = new Uint32Array(decodeBase64(toCells(canvas)).slice().buffer)
  assert.equal(cellRows(canvas), 2)
  assert.equal(words.length, 4 * 2 * 3)
  const DEFAULT = 0x01000000
  assert.deepEqual(
    [...words.slice(0, 12)],
    [
      0x20,
      DEFAULT,
      0xff0000, // même couleur en haut et en bas : espace sur fond
      0x2580,
      0xff0000,
      0x0000ff, // deux couleurs
      0x2584,
      0x00ff00,
      DEFAULT, // bas seulement
      0x20,
      DEFAULT,
      DEFAULT, // vide
    ],
  )
})

test('toSvg : un chemin par couleur, pixels nets', () => {
  const canvas = createCanvas(3, 1)
  canvas.px.set([0xff0000, 0xff0000, 0x00ff00])
  const svg = toSvg(canvas)
  assert.match(svg, /viewBox="0 0 3 1"/)
  assert.match(svg, /<path fill="#ff0000" d="M0 0h2v1h-2z"\/>/)
  assert.match(svg, /<path fill="#00ff00" d="M2 0h1v1h-1z"\/>/)
  assert.match(svg, /crispEdges/)
})
