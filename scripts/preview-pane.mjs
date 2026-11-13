#!/usr/bin/env node
// Rend le panneau (les cinq onglets) et quelques commandes via le faux hôte, sans Claude.
// Joue d'abord une petite partie pour avoir des données : tours, rencontre, capture, boost.
//
// Usage : node scripts/preview-pane.mjs [surface]   (terminal par défaut, ou desktop)

import { treeToLines } from './preview-lib.mjs'
import { createStubHost, flatten } from './stub-host.mjs'

const surface = process.argv[2] ?? 'terminal'
const host = await createStubHost({ surface, env: { TOKEMON_DEBUG: '1' }, bodyColumns: 60 })
await host.start()
await host.command('start salamèche')
for (const tokens of [1800, 4200, 2600, 900]) await host.turn(tokens)
await host.command('debug encounter roucool')
await host.command('catch')
await host.command('debug encounter dracolosse shiny')
await host.command('debug item hyper ball 2')
await host.command('catch hyper')
await host.command('debug item lucky egg')
await host.command('use lucky egg')
await host.command('debug drop pierre feu')
await host.turn(3100)

for (const tab of ['équipe', 'sac', 'dex', 'succès', 'stats']) {
  await host.command('pane ' + tab)
  console.log(`\n══ Panneau · ${tab} (${surface}) ══`)
  console.log(treeToLines(await host.render('Pane')).join('\n'))
}
console.log('\n══ /tokemon ══')
console.log(await host.command(''))
console.log('\n══ /tokemon help ══')
console.log(await host.command('help'))
console.log('\n══ Toasts ══')
console.log(host.ui.toasts.join('\n'))
const widget = await host.render('Pane', { placement: 'widget' })
console.log(`\n══ Widget (${flatten(widget).length} nœuds) ══`)
console.log(treeToLines(widget).join('\n'))
process.exit(0)
