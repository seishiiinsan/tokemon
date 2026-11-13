import { activeMon, addItem, done, fail } from '../core/context.js'
import { spawnWild } from '../core/encounter.js'
import { startLevelEvolution } from '../core/evolution.js'
import { grantXp } from '../core/xp.js'
import { findItem } from '../data/items.js'
import { findSpecies, speciesName } from '../data/lookup.js'
import { hasSprite } from '../ui/render/frames.js'

// Triche de dev, désactivée hors TOKEMON_DEBUG=1.

/** @type {import('./index.js').Command} */
export const debug = {
  name: 'debug',
  usage: '/tokemon debug <xp|encounter|item|tokens> …',
  about: 'Triche de dev (TOKEMON_DEBUG=1)',
  debugOnly: true,
  async run(app, args) {
    const [what = '', ...rest] = args.split(/\s+/).filter(Boolean)
    switch (what) {
      case 'xp': {
        const amount = Number(rest[0])
        if (!Number.isFinite(amount) || amount <= 0) return 'Usage : /tokemon debug xp <quantité>'
        const result = await app.act((save, ctx) => {
          const mon = activeMon(save)
          if (!mon) return fail('Pas de compagnon actif.')
          const events = [...grantXp(save, mon, Math.floor(amount)), ...startLevelEvolution(save, ctx)]
          return done(`+${Math.floor(amount)} XP → niveau ${mon.level}.`, events)
        })
        return result.message
      }
      case 'encounter': {
        const shiny = rest.at(-1) === 'shiny' ? Boolean(rest.pop()) : undefined
        const species = rest.length > 0 ? findSpecies(rest.join(' ')) : undefined
        if (rest.length > 0 && (!species || !hasSprite(species)))
          return `Espèce inconnue ou sprites non téléchargés : « ${rest.join(' ')} ».`
        const result = await app.act((save, ctx) => {
          const events = spawnWild(save, ctx, { species, shiny })
          const wild = save.state.wild
          return wild
            ? done(`Un ${speciesName(wild.species)} sauvage apparaît (niv. ${wild.level}).`, events)
            : fail('Aucun mon disponible.')
        })
        return result.message
      }
      case 'item': {
        const count = /^\d+$/.test(rest.at(-1) ?? '') ? Number(rest.pop()) : 1
        const item = findItem(rest.join(' '))
        if (!item) return 'Usage : /tokemon debug item <item> [quantité]'
        const result = await app.act((save) => {
          addItem(save, item.id, count)
          return done(`+${count} ${item.name}.`)
        })
        return result.message
      }
      case 'tokens': {
        const reading = app.lastReading()
        if (!reading) return 'Aucun tour mesuré dans cette session.'
        return `Dernier tour : ${reading.approximate ? '≈ ' : ''}${reading.tokens} output tokens, source : ${reading.source}${reading.approximate ? ' (estimation)' : ' (réel)'}.`
      }
      default:
        return this.usage
    }
  },
}
