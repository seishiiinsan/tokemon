#!/usr/bin/env node
// Valide les manifestes du plugin et la cohérence des tables de jeu. Lancé par la CI.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
/** @type {string[]} */
const errors = []
/** @param {unknown} condition @param {string} message */
const check = (condition, message) => void (condition || errors.push(message))
/** @param {string} path */
const json = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'))

// ── Manifestes ───────────────────────────────────────────────────────────────
const plugin = json('.claude-plugin/plugin.json')
const marketplace = json('.claude-plugin/marketplace.json')
const hooks = json('hooks/hooks.json')
check(/^[a-z0-9-]{1,64}$/.test(plugin.name), 'plugin.json : nom invalide')
check(plugin.version === json('package.json').version, 'plugin.json et package.json : versions différentes')
check(
  marketplace.plugins?.some((/** @type {{ name: string }} */ entry) => entry.name === plugin.name),
  'marketplace.json ne liste pas le plugin',
)
for (const module of hooks.modules ?? [])
  check(existsSync(join(ROOT, 'hooks', module)), `hooks.json : module introuvable ${module}`)
check(hooks.modules?.length === 1, 'hooks.json : un seul module attendu')

if (errors.length > 0) {
  console.error(errors.map((error) => '✗ ' + error).join('\n'))
  process.exit(1)
}
console.log('✓ données valides')
