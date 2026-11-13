import assert from 'node:assert/strict'
import { test } from 'node:test'
import { HISTORY_DAYS_MAX, HISTORY_EVENTS_MAX } from '../../hooks/config.js'
import {
  compactNumber,
  dashboard,
  dayKey,
  dexCompletion,
  lastDays,
  logEvents,
  recordDay,
  sparkline,
  touchStreak,
} from '../../hooks/core/stats.js'
import { emptySave } from '../../hooks/store/schema.js'
import { NOW } from '../helpers/save.js'

const DAY = 24 * 3600 * 1000

test('recordDay cumule par jour local et garde 365 jours', () => {
  const save = emptySave()
  recordDay(save, 100, 100, NOW)
  recordDay(save, 50, 80, NOW + 1000)
  recordDay(save, 7, 7, NOW - DAY)
  assert.deepEqual(save.history.days, [
    { date: dayKey(NOW - DAY), outputTokens: 7, xp: 7 },
    { date: dayKey(NOW), outputTokens: 150, xp: 180 },
  ])
  for (let i = 0; i < HISTORY_DAYS_MAX + 20; i++) recordDay(save, 1, 1, NOW + i * DAY)
  assert.equal(save.history.days.length, HISTORY_DAYS_MAX)
  assert.equal(save.history.days.at(-1)?.date, dayKey(NOW + (HISTORY_DAYS_MAX + 19) * DAY))
})

test('journal : garde les 50 derniers événements notables', () => {
  const save = emptySave()
  logEvents(save, [{ type: 'level-up', monId: 1, name: 'X', from: 1, to: 2, active: true }], NOW)
  assert.equal(save.history.events.length, 0, 'une montée de niveau ne va pas au journal')
  for (let i = 0; i < HISTORY_EVENTS_MAX + 5; i++)
    logEvents(save, [{ type: 'drop', item: 'poke-ball', count: 1, reason: 'drop' }], NOW + i)
  assert.equal(save.history.events.length, HISTORY_EVENTS_MAX)
  assert.equal(save.history.events[0].at, NOW + 5)
  assert.match(save.history.events[0].text, /Poké Ball/)
})

test('série de jours consécutifs', () => {
  const save = emptySave()
  touchStreak(save, NOW)
  touchStreak(save, NOW + 3600_000)
  assert.equal(save.state.streak.count, 1)
  touchStreak(save, NOW + DAY)
  touchStreak(save, NOW + 2 * DAY)
  assert.deepEqual(save.state.streak, { lastDay: dayKey(NOW + 2 * DAY), count: 3, best: 3 })
  touchStreak(save, NOW + 5 * DAY)
  assert.equal(save.state.streak.count, 1, 'un jour sauté remet la série à 1')
  assert.equal(save.state.streak.best, 3)
})

test('lastDays et sparkline', () => {
  const save = emptySave()
  recordDay(save, 400, 0, NOW)
  recordDay(save, 100, 0, NOW - 2 * DAY)
  const days = lastDays(save, NOW, 4)
  assert.deepEqual(
    days.map((day) => day.outputTokens),
    [0, 100, 0, 400],
  )
  assert.equal(days[3].date, dayKey(NOW))
  assert.equal(sparkline([0, 100, 0, 400]), '▁▃▁█')
  assert.equal(sparkline([0, 0]), '▁▁')
  assert.equal(sparkline([]), '')
})

test('compactNumber', () => {
  assert.equal(compactNumber(950), '950')
  assert.equal(compactNumber(9_999), '9 999')
  assert.equal(compactNumber(12_345), '12,3 k')
  assert.equal(compactNumber(250_000), '250 k')
  assert.equal(compactNumber(1_250_000), '1,25 M')
})

test('complétion du Pokédex par génération, les formes comptent une fois', () => {
  const save = emptySave()
  save.dex.bulbasaur = { seen: 2, caught: 1, shiny: 0 }
  save.dex.pikachu = { seen: 1, caught: 0, shiny: 0 }
  save.dex.pikachu_female = { seen: 1, caught: 1, shiny: 0 }
  save.dex.unown_a = { seen: 1, caught: 1, shiny: 1 }
  save.dex.unown_b = { seen: 1, caught: 1, shiny: 0 }
  save.dex.inconnu = { seen: 1, caught: 1, shiny: 0 }
  const completion = dexCompletion(save)
  assert.deepEqual(completion[0], { gen: 1, seen: 2, caught: 2, total: 151 })
  assert.deepEqual(completion[1], { gen: 2, seen: 1, caught: 1, total: 100 })
  assert.deepEqual(completion[2], { gen: 3, seen: 0, caught: 0, total: 135 })
})

test('dashboard : chiffres et taux de capture', () => {
  const save = emptySave()
  assert.equal(dashboard(save, NOW).captureRate, 0)
  recordDay(save, 500, 500, NOW)
  save.state.totals.outputTokens = 500
  Object.assign(save.state.stats, { throws: 4, captures: 3, encounters: 5 })
  const board = dashboard(save, NOW)
  assert.equal(board.captureRate, 0.75)
  assert.equal(board.tokensToday, 500)
  assert.equal(board.tokensPeriod, 500)
  assert.equal(board.days.length, 30)
  assert.equal(board.sparkline.length, 30)
  assert.equal(board.totalTokens, 500)
})
