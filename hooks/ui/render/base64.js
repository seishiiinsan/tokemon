// Base64 standard (avec padding), sans dépendre de Buffer ni de Uint8Array.fromBase64 :
// le module tourne dans l'environnement du mod comme sous Node (tests).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const REVERSE = new Int16Array(128).fill(-1)
for (let i = 0; i < ALPHABET.length; i++) REVERSE[ALPHABET.charCodeAt(i)] = i

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function encodeBase64(bytes) {
  /** @type {string[]} */
  const parts = []
  let chunk = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0
    chunk += ALPHABET[b0 >> 2] + ALPHABET[((b0 & 3) << 4) | (b1 >> 4)]
    chunk += i + 1 < bytes.length ? ALPHABET[((b1 & 15) << 2) | (b2 >> 6)] : '='
    chunk += i + 2 < bytes.length ? ALPHABET[b2 & 63] : '='
    if (chunk.length >= 8192) {
      parts.push(chunk)
      chunk = ''
    }
  }
  parts.push(chunk)
  return parts.join('')
}

/**
 * Décode du base64 en ignorant les retours à la ligne (l'API contents de GitHub en insère).
 * @param {string} text
 * @returns {Uint8Array}
 */
export function decodeBase64(text) {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4))
  let length = 0
  let buffer = 0
  let bits = 0
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    const value = code < 128 ? REVERSE[code] : -1
    if (value < 0) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out[length++] = (buffer >> bits) & 255
    }
  }
  return out.subarray(0, length)
}
