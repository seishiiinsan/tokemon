#!/usr/bin/env node
// Décode sprites/<mon>/*.gif (gen 1 embarquée) et écrit hooks/data/frames.gen1.js.
// Utilise le même décodeur GIF et le même format compact que le téléchargement des gens 2 à 5 :
// aucun outil externe (ffmpeg…) n'est nécessaire.
//
// Usage : node scripts/build-frames.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPRITE_ANIMS, SPRITE_VARIANTS } from '../hooks/config.js'
import { buildSprite } from '../hooks/ui/render/frames.js'
import { decodeGif } from '../hooks/ui/render/gif.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const mons = readdirSync(join(ROOT, 'sprites'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort()

/** @type {string[]} */
const lines = []
for (const mon of mons) {
  /** @type {any} */
  const sheets = {}
  for (const variant of SPRITE_VARIANTS) {
    sheets[variant] = {}
    for (const anim of SPRITE_ANIMS) {
      sheets[variant][anim] = decodeGif(
        new Uint8Array(readFileSync(join(ROOT, 'sprites', mon, `${variant}_${anim}_8fps.gif`))),
      )
    }
  }
  lines.push(`  ${JSON.stringify(mon)}: ${JSON.stringify(buildSprite(sheets))},`)
}

writeFileSync(
  join(ROOT, 'hooks/data/frames.gen1.js'),
  `// Généré par scripts/build-frames.mjs à partir de sprites/<mon>/*.gif. Ne pas éditer à la main.
// Sprites : jakobhoeg/vscode-pokemon via dgokcin/claude-pokemon-mod. Pokémon © Nintendo / Game Freak. Voir sprites/CREDITS.md.

/** @type {Record<string, import('../ui/render/frames.js').Sprite>} */
export const GEN1_SPRITES = {
${lines.join('\n')}
}
`,
)
console.log(`${mons.length} sprites écrits dans hooks/data/frames.gen1.js`)
