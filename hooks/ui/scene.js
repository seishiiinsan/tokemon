import { BALL_TICKS, FLASH_TICKS, JUMP_TICKS, TICK_MS } from '../config.js'
import { randomInt } from '../core/rng.js'
import { spriteBitmap } from './render/frames.js'
import { createCanvas, drawBitmap, drawPixels, scaleBitmap, WHITE } from './render/paint.js'

// La scène animée de la bande : le compagnon se promène, saute quand il monte de niveau,
// clignote en blanc quand il évolue ; le mon sauvage attend à gauche, une Ball s'ouvre sur un échec.

/**
 * @typedef {object} Scene
 * @property {number} tick nombre de ticks écoulés (8 par seconde)
 * @property {number} x position du compagnon, en pixels depuis la gauche de sa zone
 * @property {1 | -1} dir sens de la marche (1 : vers la droite)
 * @property {boolean} walking
 * @property {number} rest ticks d'attente avant la prochaine promenade
 * @property {number} target position visée
 * @property {number} jump ticks de saut restants
 * @property {number} flash ticks de flash restants
 * @property {{ left: number, caught: boolean } | null} ball animation de Ball en cours
 */

/** @returns {Scene} */
export const createScene = () => ({
  tick: 0,
  x: 0,
  dir: -1,
  walking: false,
  rest: 16,
  target: 0,
  jump: 0,
  flash: 0,
  ball: null,
})

/**
 * Avance la scène d'un tick.
 * @param {Scene} scene
 * @param {import('../core/rng.js').Rng} rng
 * @param {number} room largeur de la zone où le compagnon peut marcher, en pixels
 */
export function stepScene(scene, rng, room) {
  scene.tick += 1
  if (scene.jump > 0) scene.jump -= 1
  if (scene.flash > 0) scene.flash -= 1
  if (scene.ball && --scene.ball.left <= 0) scene.ball = null
  const max = Math.max(0, room)
  scene.x = Math.min(scene.x, max)
  if (scene.walking) {
    if (scene.x === scene.target) {
      scene.walking = false
      scene.rest = randomInt(rng, 16, 56)
    } else {
      scene.x += scene.dir
    }
    return
  }
  if (--scene.rest > 0 || max === 0) return
  scene.target = randomInt(rng, 0, max)
  if (scene.target === scene.x) {
    scene.rest = 8
    return
  }
  scene.dir = scene.target > scene.x ? 1 : -1
  scene.walking = true
}

/** @param {Scene} scene */
export const startJump = (scene) => void (scene.jump = JUMP_TICKS)
/** @param {Scene} scene */
export const startFlash = (scene) => void (scene.flash = FLASH_TICKS)
/** @param {Scene} scene @param {boolean} caught */
export const startBall = (scene, caught) => void (scene.ball = { left: BALL_TICKS, caught })

const BALL_COLORS = { r: 0xe03030, k: 0x202020, w: 0xf0f0f0, y: 0xf8d030 }
const BALL_TOP = ['..rrr..', '.rrrrr.', 'rrrwrrr']
const BALL_BOTTOM = ['kkkwkkk', 'wwwwwww', '.wwwww.', '..www..']
const STAR = ['.y.', 'yyy', '.y.']

/**
 * @typedef {object} SceneView
 * @property {number} columns largeur de la scène en pixels (une colonne de terminal par pixel)
 * @property {number} rows hauteur en lignes de terminal (deux pixels par ligne)
 * @property {{ species: string, variant: import('./render/frames.js').Variant } | null} active
 * @property {{ species: string, shiny: boolean } | null} wild
 * @property {boolean} evolving une évolution est annoncée
 * @property {Scene} scene
 */

/**
 * La largeur dont le compagnon dispose pour marcher.
 * @param {SceneView} view
 * @returns {{ left: number, room: number, activeScale: number, wildScale: number }}
 */
export function sceneLayout(view) {
  const height = view.rows * 2
  const active = view.active && spriteBitmap(view.active.species, view.active.variant, 'idle', 0)
  const wild = view.wild && spriteBitmap(view.wild.species, 'default', 'idle', 0)
  const activeScale = active ? Math.min(1, height / active.h) : 1
  const wildScale = wild ? Math.min(1, height / wild.h) : 1
  // Le mon sauvage occupe la gauche de la scène : le compagnon garde le reste
  const left = wild ? Math.min(view.columns, Math.round(wild.w * wildScale) + 4) : 0
  const width = active ? Math.round(active.w * activeScale) : 0
  return { left, room: Math.max(0, view.columns - left - width), activeScale, wildScale }
}

/**
 * Dessine la scène à l'instant courant.
 * @param {SceneView} view
 * @returns {import('./render/frames.js').Bitmap}
 */
export function composeScene(view) {
  const { scene } = view
  const canvas = createCanvas(view.columns, view.rows * 2)
  const elapsed = scene.tick * TICK_MS
  const layout = sceneLayout(view)

  if (view.wild) {
    const image = spriteBitmap(view.wild.species, view.wild.shiny ? 'shiny' : 'default', 'idle', elapsed)
    if (image) {
      const scaled = scaleBitmap(image, layout.wildScale)
      // Pendant l'animation de capture, le mon est dans la Ball
      // Le mon sauvage regarde le compagnon, à sa droite
      if (!scene.ball) drawBitmap(canvas, scaled, 1, canvas.h - scaled.h, { flip: true })
      else drawBall(canvas, 1 + Math.floor(scaled.w / 2) - 3, canvas.h - 7, scene.ball)
    }
  } else if (scene.ball) {
    drawBall(canvas, 4, canvas.h - 7, scene.ball)
  }

  if (view.active) {
    const image = spriteBitmap(view.active.species, view.active.variant, scene.walking ? 'walk' : 'idle', elapsed)
    if (image) {
      const scaled = scaleBitmap(image, layout.activeScale)
      const lift = scene.jump > 0 ? Math.round(Math.sin((Math.PI * scene.jump) / JUMP_TICKS) * 5) : 0
      const flashing = (view.evolving || scene.flash > 0) && scene.tick % 4 < 2
      drawBitmap(canvas, scaled, layout.left + Math.min(scene.x, layout.room), canvas.h - scaled.h - lift, {
        // Les sprites d'origine regardent vers la gauche
        flip: scene.dir > 0,
        tint: flashing ? WHITE : undefined,
      })
    }
  }
  return canvas
}

/**
 * Une Ball fermée (capture) ou qui s'ouvre (échec).
 * @param {import('./render/frames.js').Bitmap} canvas
 * @param {number} left
 * @param {number} top
 * @param {{ left: number, caught: boolean }} ball
 */
function drawBall(canvas, left, top, ball) {
  const opening = !ball.caught && ball.left <= BALL_TICKS / 2
  drawPixels(canvas, BALL_TOP, BALL_COLORS, left, top - (opening ? 3 : 0))
  drawPixels(canvas, BALL_BOTTOM, BALL_COLORS, left, top + 3)
  if (ball.caught && ball.left % 4 < 2) drawPixels(canvas, STAR, BALL_COLORS, left + 8, top - 2)
}
