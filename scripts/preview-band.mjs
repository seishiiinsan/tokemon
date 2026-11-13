#!/usr/bin/env node
// Rend la bande via le faux hôte, sans Claude : dans le terminal (demi-blocs en couleurs) et
// en SVG (rendu desktop) dans preview/band.svg.
//
// Usage : node scripts/preview-band.mjs [starter] [tokens]
//   ex.   node scripts/preview-band.mjs salamèche 40000

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { treeToLines } from './preview-lib.mjs'
import { createStubHost, flatten } from './stub-host.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const [starter = 'pikachu', tokens = '1500'] = process.argv.slice(2)

for (const surface of ['terminal', 'desktop']) {
  const host = await createStubHost({ surface, env: { TOKEMON_DEBUG: '1' } })
  await host.start()
  console.log(`── ${surface} : premier lancement ──`)
  console.log(treeToLines(await host.render('AbovePrompt')).join('\n'))
  console.log(await host.command('start ' + starter))
  await host.turn(Number(tokens))
  await host.advance(3000)
  const band = await host.render('AbovePrompt')
  console.log(`── ${surface} : après un tour de ${tokens} tokens ──`)
  console.log(treeToLines(band).join('\n'))
  for (const toast of host.ui.toasts) console.log('  toast : ' + toast)
  const svg = flatten(band).find((node) => node.type === 'Svg')
  if (svg) {
    mkdirSync(join(ROOT, 'preview'), { recursive: true })
    writeFileSync(join(ROOT, 'preview/band.svg'), svg.props.source)
    console.log('→ preview/band.svg')
  }
}
process.exit(0)
