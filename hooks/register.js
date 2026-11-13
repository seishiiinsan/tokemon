import { createApp } from './app.js'
import { runCommand } from './commands/index.js'
import { PANE_ID } from './config.js'

// Point d'entrée du mod : routage des événements de l'hôte vers le runtime (app.js),
// rien d'autre. La logique de jeu est dans core/, le dessin dans ui/.
//
// C'est aussi le SEUL fichier qui touche à `$`. Le moteur exige que chaque appel soit écrit
// `$.nom.méthode(...)` sur place (`claude plugin validate` refuse un `$` passé à un autre module) :
// `hostOf` enveloppe donc chaque appel dans une fonction, et le reste du mod ne connaît que cet
// adaptateur, typé par `Host` (types.js) et remplaçable par un faux dans les tests.

/** @typedef {import('./types.js').Host} Host */
/** @typedef {(e: any) => Promise<any>} Next */

/**
 * @param {any} $ l'interface du moteur reçue par un hook
 * @returns {Host}
 */
function hostOf($) {
  return {
    store: {
      get: (key) => $.store.get(key),
      set: (key, value) => $.store.set(key, value),
      delete: (key) => $.store.delete(key),
      keys: () => $.store.keys(),
    },
    clock: {
      now: () => $.clock.now(),
      every: (ms, fn) => $.clock.every(ms, fn),
      after: (ms, fn) => $.clock.after(ms, fn),
    },
    ui: {
      invalidate: (event) => $.ui.invalidate(event),
      toast: (text) => $.ui.toast(text),
      open: (pane) => $.ui.open(pane),
      close: (pane) => $.ui.close(pane),
      blit: (args) => $.ui.blit(args),
      resolve: (e) => $.ui.resolve(e),
    },
    command: { register: (spec) => $.command.register(spec) },
    http: { fetch: (url, init) => $.http.fetch(url, init) },
    fs: {
      read: (path) => $.fs.read(path),
      write: (path, text) => $.fs.write(path, text),
      exists: (path) => $.fs.exists(path),
    },
    env: {
      // Le moteur veut des noms de variables littéraux : une branche par variable lue
      get: async (name) => {
        if (name === 'TOKEMON_DEBUG') return $.env.get('TOKEMON_DEBUG')
        if (name === 'HOME') return $.env.get('HOME')
        if (name === 'USERPROFILE') return $.env.get('USERPROFILE')
        return undefined
      },
    },
    plugin: { name: $.plugin.name, root: $.plugin.root },
  }
}

/**
 * @param {(event: string, ...rest: any[]) => unknown} on
 */
export function register(on) {
  const app = createApp()

  on('session.start', async (/** @type {any} */ $, /** @type {unknown} */ e, /** @type {Next} */ next) => {
    await app.start(hostOf($))
    return next(e)
  })

  on(
    'turn.complete',
    async (/** @type {any} */ $, /** @type {import('./types.js').TurnEvent} */ e, /** @type {Next} */ next) => {
      await app.onTurn(hostOf($), e)
      return next(e)
    },
  )

  on(
    'command.run',
    { command: 'tokemon' },
    async (/** @type {any} */ _$, /** @type {import('./types.js').CommandEvent} */ e) => ({
      text: await runCommand(app, e.args ?? ''),
    }),
  )

  on(
    'ui.render',
    { component: 'AbovePrompt' },
    (/** @type {any} */ $, /** @type {import('./types.js').RenderEvent} */ e, /** @type {Next} */ next) => {
      return app.drawBand(hostOf($), e) ?? next(e)
    },
  )

  on(
    'ui.render',
    { component: 'Pane', requestId: 'tokemon' },
    (/** @type {any} */ $, /** @type {import('./types.js').RenderEvent} */ e, /** @type {Next} */ next) => {
      return app.drawPane(hostOf($), e) ?? next(e)
    },
  )

  on(
    'ui.close',
    async (
      /** @type {any} */ _$,
      /** @type {{ id: string, origin?: { kind: string } }} */ e,
      /** @type {Next} */ next,
    ) => {
      if (e.id === PANE_ID && e.origin?.kind === 'person') await app.onPaneClosed()
      return next(e)
    },
  )
}
