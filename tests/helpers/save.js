import { addItem, addMon } from '../../hooks/core/context.js'
import { createRng } from '../../hooks/core/rng.js'
import { emptySave } from '../../hooks/store/schema.js'

// Fabriques partagées par les tests du core.

export const NOW = Date.UTC(2026, 0, 15, 12)

/**
 * Un contexte de test : RNG semé, horloge fixe.
 * @param {{ seed?: number, now?: number, rolls?: number[], available?: (id: string) => boolean }} [options]
 *   `rolls` impose les prochains tirages (puis le RNG semé reprend)
 * @returns {import('../../hooks/core/context.js').Ctx}
 */
export function testCtx({ seed = 1, now = NOW, rolls = [], available } = {}) {
  const seeded = createRng(seed)
  const queue = [...rolls]
  return { rng: () => queue.shift() ?? seeded(), now, available }
}

/**
 * Une sauvegarde avec un starter déjà choisi.
 * @param {{ species?: string, level?: number, bag?: Record<string, number> }} [options]
 */
export function startedSave({ species = 'bulbasaur', level = 5, bag = {} } = {}) {
  const save = emptySave()
  const mon = addMon(save, { species, level }, NOW)
  save.state.activeMonId = mon.id
  save.state.starterChosen = true
  for (const [item, count] of Object.entries(bag)) addItem(save, item, count)
  return { save, mon }
}
