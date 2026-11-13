#!/usr/bin/env node
// Télécharge d'un coup tous les sprites d'une ou plusieurs générations, sans passer par l'API
// GitHub (donc sans sa limite de 60 requêtes par heure) : clone partiel du dépôt de sprites,
// décodage avec le décodeur du mod, écriture du cache que le mod charge au démarrage.
// Alternative à /tokemon download, à lancer depuis le dépôt (git requis).
//
// Usage : node scripts/fetch-gen.mjs gen2 [gen3 gen4 gen5] [--out <dossier>]

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DOWNLOADABLE_GENS, SPRITE_ANIMS, SPRITE_VARIANTS } from '../hooks/config.js'
import { SPECIES } from '../hooks/data/species.js'
import { buildSprite } from '../hooks/ui/render/frames.js'
import { decodeGif } from '../hooks/ui/render/gif.js'

const REPO = 'https://github.com/jakobhoeg/vscode-pokemon'
const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const out = outIndex >= 0 ? args[outIndex + 1] : join(homedir(), '.claude', 'tokemon', 'sprites')
const gens = args
  .filter((arg, index) => /^gen\d$/.test(arg) && index !== outIndex + 1)
  .map((arg) => Number(arg.slice(3)))
if (gens.length === 0 || gens.some((gen) => !DOWNLOADABLE_GENS.includes(gen))) {
  console.error('Usage : node scripts/fetch-gen.mjs gen2 [gen3 gen4 gen5] [--out <dossier>]')
  process.exit(1)
}

const work = mkdtempSync(join(tmpdir(), 'tokemon-sprites-'))
const git = (/** @type {string[]} */ ...command) =>
  execFileSync('git', command, { cwd: work, stdio: ['ignore', 'ignore', 'inherit'] })
try {
  console.log('Clone partiel de ' + REPO + '…')
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', REPO, work], {
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  git('sparse-checkout', 'set', ...gens.map((gen) => `media/gen${gen}`))
  mkdirSync(out, { recursive: true })
  for (const gen of gens) {
    const folder = join(work, 'media', `gen${gen}`)
    /** @type {Record<string, import('../hooks/ui/render/frames.js').Sprite>} */
    const sprites = {}
    /** @type {string[]} */
    const skipped = []
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      if (!entry.isDirectory() || SPECIES[entry.name]?.gen !== gen) continue
      try {
        /** @type {any} */
        const sheets = {}
        for (const variant of SPRITE_VARIANTS) {
          // La variante shiny manque en amont pour la gen 5 : le sprite n'a alors que sa forme normale
          if (variant !== 'default' && !existsSync(join(folder, entry.name, `${variant}_idle_8fps.gif`))) continue
          sheets[variant] = {}
          for (const anim of SPRITE_ANIMS) {
            sheets[variant][anim] = decodeGif(
              new Uint8Array(readFileSync(join(folder, entry.name, `${variant}_${anim}_8fps.gif`))),
            )
          }
        }
        sprites[entry.name] = buildSprite(sheets)
      } catch (error) {
        skipped.push(`${entry.name} (${error instanceof Error ? error.message : error})`)
      }
    }
    const file = join(out, `gen${gen}.json`)
    // Garde les sprites déjà en cache (téléchargés par /tokemon download)
    const previous = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')).sprites ?? {}) : {}
    const text = JSON.stringify({ version: 1, gen, sprites: { ...previous, ...sprites } })
    writeFileSync(file, text)
    console.log(`gen${gen} : ${Object.keys(sprites).length} sprites → ${file} (${(text.length / 1024).toFixed(0)} Kio)`)
    if (skipped.length > 0) console.warn(`  ignorés : ${skipped.join(', ')}`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
