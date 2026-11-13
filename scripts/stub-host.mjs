// Faux hôte Claude Code pour les tests et les scripts de preview : il charge le vrai
// hooks/register.js et lui fournit un `$` en mémoire (store, horloge manuelle, UI enregistrée,
// système de fichiers et réseau simulés). Aucune dépendance au runtime de Claude.

/**
 * @typedef {object} StubOptions
 * @property {Record<string, unknown>} [saved] contenu initial du store
 * @property {Map<string, unknown>} [store] store partagé entre plusieurs hôtes (sessions concurrentes)
 * @property {number} [now] heure initiale (ms)
 * @property {Record<string, string>} [env]
 * @property {Record<string, string>} [files] fichiers initiaux
 * @property {(url: string) => { status: number, text: string } | undefined} [http]
 * @property {string} [surface] 'terminal' (défaut) ou 'desktop'
 * @property {number} [bodyColumns]
 */

/** @typedef {{ type: string, props: Record<string, any> }} StubNode */

/** @param {unknown} matcher @param {any} e @returns {boolean} */
function matches(matcher, e) {
  if (!matcher || typeof matcher !== 'object') return true
  return Object.entries(matcher).every(([key, value]) =>
    value && typeof value === 'object' ? matches(value, e?.[key]) : e?.[key] === value,
  )
}

/** Les éléments d'une surface : chaque constructeur renvoie un nœud inspectable { type, props } */
const ELEMENTS = {
  terminal: ['Box', 'Text', 'Button', 'Raster', 'Progress'],
  desktop: ['Box', 'Text', 'Button', 'Svg', 'Progress'],
}

/**
 * @param {StubOptions} [options]
 */
export async function createStubHost(options = {}) {
  const store = options.store ?? new Map(Object.entries(options.saved ?? {}))
  const files = new Map(Object.entries(options.files ?? {}))
  const surface = options.surface ?? 'terminal'
  /** @type {Record<string, { matcher: unknown, fn: Function }[]>} */
  const hooks = {}
  /** @type {{ ms: number, fn: () => void, cancelled: boolean, every: boolean, due: number }[]} */
  const timers = []
  const ui = {
    /** @type {string[]} */ toasts: [],
    /** @type {Record<string, unknown>[]} */ blits: [],
    /** @type {string[]} */ opened: [],
    /** @type {string[]} */ closed: [],
    invalidations: 0,
    /** @type {string[]} */ commands: [],
    /** @type {string[]} */ requests: [],
  }
  let now = options.now ?? Date.UTC(2026, 0, 15, 12)

  /** @param {number} ms @param {() => void} fn @param {boolean} every */
  const timer = (ms, fn, every) => {
    const entry = { ms, fn, cancelled: false, every, due: now + ms }
    timers.push(entry)
    return { cancel: () => void (entry.cancelled = true) }
  }

  const $ = {
    store: {
      get: async (/** @type {string} */ key) => structuredClone(store.get(key)),
      set: async (/** @type {string} */ key, /** @type {unknown} */ value) =>
        void store.set(key, JSON.parse(JSON.stringify(value))),
      delete: async (/** @type {string} */ key) => void store.delete(key),
      keys: async () => [...store.keys()],
    },
    clock: {
      now: async () => now,
      every: (/** @type {number} */ ms, /** @type {() => void} */ fn) => timer(ms, fn, true),
      after: (/** @type {number} */ ms, /** @type {() => void} */ fn) => timer(ms, fn, false),
    },
    ui: {
      invalidate: () => void ui.invalidations++,
      toast: (/** @type {string} */ text) => void ui.toasts.push(text),
      open: async (/** @type {{ id: string }} */ pane) => {
        ui.opened.push(pane.id)
        return { isPlaced: true }
      },
      close: async (/** @type {{ id: string }} */ pane) => void ui.closed.push(pane.id),
      blit: async (/** @type {Record<string, unknown>} */ args) => {
        ui.blits.push(args)
        return {}
      },
      resolve: (/** @type {{ surface: string }} */ e) =>
        Object.fromEntries(
          (ELEMENTS[/** @type {'terminal' | 'desktop'} */ (e.surface)] ?? ELEMENTS.desktop).map((type) => [
            type,
            (/** @type {Record<string, any>} */ props) => ({ type, props }),
          ]),
        ),
    },
    command: { register: async (/** @type {{ name: string }} */ spec) => void ui.commands.push(spec.name) },
    http: {
      fetch: async (/** @type {string} */ url) => {
        ui.requests.push(url)
        const answer = options.http?.(url) ?? { status: 404, text: '{}' }
        return {
          status: answer.status,
          ok: answer.status >= 200 && answer.status < 300,
          headers: {},
          text: answer.text,
        }
      },
    },
    fs: {
      read: async (/** @type {string} */ path) => {
        if (!files.has(path)) throw new Error('ENOENT: ' + path)
        return /** @type {string} */ (files.get(path))
      },
      write: async (/** @type {string} */ path, /** @type {string} */ text) => void files.set(path, text),
      exists: async (/** @type {string} */ path) => files.has(path),
    },
    env: { get: async (/** @type {string} */ name) => options.env?.[name] },
    plugin: { name: 'tokemon', root: '/plugin' },
  }

  /**
   * Déclenche un événement comme l'hôte : le premier hook dont le matcher correspond reçoit ($, e, next).
   * @param {string} event
   * @param {Record<string, any>} [e]
   * @param {unknown} [result] ce que répond `next(e)`
   */
  async function fire(event, e = {}, result = undefined) {
    let answer = result
    for (const hook of hooks[event] ?? []) {
      if (!matches(hook.matcher, e)) continue
      answer = await hook.fn($, e, async () => result)
    }
    return answer
  }

  /** @param {string} component @param {Record<string, any>} [props] @param {string} [requestId] */
  const render = (component, props = {}, requestId = component === 'Pane' ? 'tokemon' : 'band') =>
    /** @type {Promise<StubNode | undefined>} */ (
      fire('ui.render', {
        component,
        surface,
        requestId,
        viewport: { columns: 120, rows: 40 },
        props: {
          hasSurvey: false,
          isWorking: false,
          maxRows: 20,
          bodyColumns: options.bodyColumns ?? 110,
          placement: 'dock',
          ...props,
        },
      })
    )

  /** Avance l'horloge et exécute les timers arrivés à échéance. @param {number} ms */
  async function advance(ms) {
    const target = now + ms
    for (;;) {
      const next = timers.filter((entry) => !entry.cancelled && entry.due <= target).sort((a, b) => a.due - b.due)[0]
      if (!next) break
      now = next.due
      if (next.every) next.due += next.ms
      else next.cancelled = true
      next.fn()
      await new Promise((resolve) => setImmediate(resolve))
    }
    now = target
    await new Promise((resolve) => setImmediate(resolve))
  }

  const { register } = await import('../hooks/register.js')
  register((/** @type {string} */ event, /** @type {any} */ matcher, /** @type {any} */ fn) => {
    if (typeof matcher === 'function') [fn, matcher] = [matcher, null]
    ;(hooks[event] ??= []).push({ matcher, fn })
  })

  return {
    $,
    ui,
    store,
    files,
    fire,
    render,
    advance,
    /** Démarre la session (charge l'état, enregistre la commande). */
    start: () => fire('session.start', { cwd: '/work', surface, isInteractive: true }, { cwd: '/work' }),
    /** @param {string} [args] @returns {Promise<string>} le texte répondu par /tokemon */
    command: async (args = '') =>
      /** @type {any} */ (await fire('command.run', { command: 'tokemon', args }))?.text ?? '',
    /** Termine un tour avec `tokens` output tokens réels. @param {number} tokens @param {Record<string, any>} [extra] */
    turn: (tokens, extra = {}) =>
      fire(
        'turn.complete',
        {
          turnId: 'turn-' + Math.random().toString(36).slice(2),
          answer: 'ok',
          durationMs: 1000,
          isAborted: false,
          reason: 'answer',
          usage: { output_tokens: tokens, model: 'stub' },
          ...extra,
        },
        { text: 'ok' },
      ),
    setNow: (/** @type {number} */ value) => void (now = value),
    now: () => now,
  }
}

/**
 * Tous les nœuds d'un arbre rendu, à plat.
 * @param {any} node
 * @returns {StubNode[]}
 */
export function flatten(node) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(flatten)
  return [node, ...flatten(node.props?.children)]
}

/**
 * Le texte d'un arbre rendu, ligne par ligne approximativement (un Text par segment).
 * @param {any} node
 * @returns {string}
 */
export function textOf(node) {
  if (node === null || node === undefined || node === false) return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  const own = node.props?.label ?? ''
  const inner = textOf(node.props?.children)
  return own + inner + (node.type === 'Text' || node.type === 'Button' ? '\n' : '')
}
