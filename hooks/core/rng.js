// Générateur pseudo-aléatoire injectable. Tout le core reçoit un `Rng` en paramètre :
// en production il est semé par l'horloge, en test par une seed fixe (tirages reproductibles).

/** @typedef {() => number} Rng fonction renvoyant un flottant dans [0, 1) */

/**
 * PRNG déterministe (sfc32, état initialisé par un mélange de la seed).
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = 0x9e3779b9 ^ seed
  let b = 0x243f6a88 + seed
  let c = 0xb7e15162 ^ (seed << 7)
  let d = 1
  const next = () => {
    a |= 0
    b |= 0
    c |= 0
    d |= 0
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
  for (let i = 0; i < 12; i++) next()
  return next
}

/**
 * @param {Rng} rng
 * @param {number} probability entre 0 et 1
 */
export function chance(rng, probability) {
  return rng() < probability
}

/**
 * Entier uniforme dans [min, max] (bornes incluses).
 * @param {Rng} rng
 * @param {number} min
 * @param {number} max
 */
export function randomInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * Tirage pondéré. Renvoie `undefined` si la liste est vide ou si tous les poids sont nuls.
 * @template T
 * @param {Rng} rng
 * @param {readonly T[]} items
 * @param {(item: T) => number} weightOf
 * @returns {T | undefined}
 */
export function pickWeighted(rng, items, weightOf) {
  let total = 0
  for (const item of items) total += Math.max(0, weightOf(item))
  if (total <= 0) return undefined
  let roll = rng() * total
  for (const item of items) {
    roll -= Math.max(0, weightOf(item))
    if (roll < 0) return item
  }
  return items[items.length - 1]
}
