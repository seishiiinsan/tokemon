import { achievements } from './achievements.js'
import { bag } from './bag.js'
import { box } from './box.js'
import { catchWild } from './catch.js'
import { debug } from './debug.js'
import { dex } from './dex.js'
import { download } from './download.js'
import { evolve, stop } from './evolve.js'
import { createHelp } from './help.js'
import { nick } from './nick.js'
import { pane } from './pane.js'
import { start } from './start.js'
import { stats } from './stats.js'
import { summary } from './summary.js'
import { switchMon } from './switch.js'
import { use } from './use.js'
import { normal, shiny } from './variant.js'

// Routage des sous-commandes de /tokemon : un fichier par sous-commande.

/**
 * @typedef {object} Command
 * @property {string} name premier mot après /tokemon ('' : la commande nue)
 * @property {string} usage
 * @property {string} about ligne d'aide
 * @property {boolean} [debugOnly] désactivée hors TOKEMON_DEBUG=1
 * @property {(app: import('../app.js').App, args: string) => Promise<string>} run
 */

/** @type {Command[]} */
export const COMMANDS = [
  summary,
  start,
  switchMon,
  box,
  bag,
  use,
  evolve,
  stop,
  catchWild,
  dex,
  achievements,
  stats,
  pane,
  nick,
  shiny,
  normal,
  download,
  debug,
]
COMMANDS.push(createHelp(() => COMMANDS))

/**
 * @param {import('../app.js').App} app
 * @param {string} rawArgs ce qui suit /tokemon
 * @returns {Promise<string>} le texte de la réponse
 */
export async function runCommand(app, rawArgs) {
  const text = rawArgs.trim()
  const space = text.search(/\s/)
  const name = (space < 0 ? text : text.slice(0, space)).toLowerCase()
  const args = space < 0 ? '' : text.slice(space + 1).trim()
  const command = COMMANDS.find((candidate) => candidate.name === name)
  if (!command) return `Commande inconnue : « ${name} ». /tokemon help pour la liste.`
  if (command.debugOnly && !app.isDebug())
    return 'Commande de debug : relance Claude Code avec TOKEMON_DEBUG=1 pour l’activer.'
  try {
    return await command.run(app, args)
  } catch (error) {
    return `Tokemon : erreur pendant « ${command.usage} » (${error instanceof Error ? error.message : String(error)}).`
  }
}
