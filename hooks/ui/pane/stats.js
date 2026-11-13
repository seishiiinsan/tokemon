import { STATS_DAYS } from '../../config.js'
import { compactNumber, dashboard } from '../../core/stats.js'
import { textLines } from './widgets.js'

// Onglet Stats : tokens par jour (30 jours), totaux, captures, items, et le journal.

/**
 * @param {import('../../store/schema.js').Save} save
 * @param {number} now
 * @returns {string[]} le tableau de bord, sans le journal
 */
export function statsLines(save, now) {
  const board = dashboard(save, now)
  const approx = board.approximateTokens > 0 ? '≈ ' : ''
  const percent = (/** @type {number} */ ratio) => `${Math.round(ratio * 100)} %`
  return [
    `Output tokens, ${STATS_DAYS} derniers jours`,
    board.sparkline,
    `Aujourd'hui ${compactNumber(board.tokensToday)} · ${STATS_DAYS} jours ${compactNumber(board.tokensPeriod)}`,
    '',
    `Tokens au total : ${approx}${compactNumber(board.totalTokens)}${board.approximateTokens > 0 ? ` (dont ${compactNumber(board.approximateTokens)} estimés)` : ''}`,
    `XP totale : ${compactNumber(board.totalXp)} · ${board.turns} tours`,
    `Rencontres : ${board.encounters} · captures : ${board.captures} · fuites : ${board.fled}`,
    `Taux de capture : ${board.throws > 0 ? percent(board.captureRate) : 'aucun lancer'} (${board.captures}/${board.throws} lancers)`,
    `Shiny : ${board.shinyCaught} capturés · ${board.shinySeen} vus`,
    `Items : ${board.itemsFound} obtenus · ${board.itemsUsed} utilisés`,
    `Box : ${board.boxSize} mons · ${board.evolutions} évolutions`,
    `Série : ${board.streak} jour${board.streak > 1 ? 's' : ''} d'affilée (record ${board.bestStreak})`,
  ]
}

/**
 * @param {import('../../store/schema.js').Save} save
 * @returns {string[]} le journal, du plus récent au plus ancien
 */
export function journalLines(save) {
  const pad = (/** @type {number} */ value) => String(value).padStart(2, '0')
  return [...save.history.events].reverse().map((entry) => {
    const date = new Date(entry.at)
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}  ${entry.text}`
  })
}

/**
 * @param {import('./index.js').PaneContext} context
 * @returns {import('../../types.js').UiNode[]}
 */
export function statsTab(context) {
  const [title, spark, ...rest] = statsLines(context.save, context.now)
  const journal = journalLines(context.save)
  return [
    ...textLines(context, [title], { bold: true }),
    ...(context.elements.Text ? [context.elements.Text({ color: 'success', children: [spark] })] : []),
    ...textLines(context, rest),
    ...textLines(context, ['', `Journal (${journal.length})`], { bold: true }),
    ...textLines(context, journal.length > 0 ? journal : ['Rien pour le moment.'], { dim: journal.length === 0 }),
  ]
}
