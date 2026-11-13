import { COMMAND_NAME, DESKTOP_REDRAW_TICKS, TICK_MS } from './config.js'
import { createRng } from './core/rng.js'
import { logEvents, touchStreak } from './core/stats.js'
import { applyTurn, housekeeping, needsHousekeeping } from './core/turn.js'
import { GEN1_SPRITES } from './data/frames.gen1.js'
import { createRepo } from './store/repo.js'
import { getOutputTokens } from './tokens/index.js'
import { RASTER_KEY, renderBand, sceneSize, sceneView } from './ui/band.js'
import { hasSprite, registerSprites } from './ui/render/frames.js'
import { toCells } from './ui/render/paint.js'
import { composeScene, createScene, sceneLayout, startBall, startFlash, startJump, stepScene } from './ui/scene.js'
import { toastEvents } from './ui/toasts.js'

// Le runtime du mod : relie l'hôte ($), le store, le core et l'interface.
// Aucune règle de jeu ici : il charge, appelle le core dans une transaction, puis annonce
// et anime les événements que le core a produits.

/** @typedef {import('./types.js').Host} Host */
/** @typedef {import('./store/schema.js').Save} Save */
/** @typedef {import('./core/context.js').Ctx} Ctx */
/** @typedef {import('./core/context.js').ActionResult} ActionResult */
/** @typedef {import('./core/events.js').GameEvent} GameEvent */

/** À quelle fréquence l'horloge locale est resynchronisée sur celle de l'hôte, en ticks */
const CLOCK_SYNC_TICKS = 80

export function createApp() {
  /** @type {Host | null} */
  let host = null
  /** @type {import('./store/repo.js').Repo | null} */
  let repo = null
  let rng = createRng(1)
  const scene = createScene()
  /** @type {import('./types.js').HostTimer | null} */
  let timer = null
  // L'horloge de l'hôte est asynchrone : entre deux synchronisations, on avance localement
  let clockBase = 0
  let clockTick = 0
  let busy = false
  /** La bande telle qu'elle est montée, pour la repeindre sans redessiner */
  const band = { requestId: '', surface: '', columns: 0, rows: 0, cells: '', svg: '' }
  /** @type {import('./tokens/index.js').TokenReading | null} */
  let lastReading = null
  let debug = false

  const now = () => clockBase + (scene.tick - clockTick) * TICK_MS

  /** @param {Host} $ */
  async function syncClock($) {
    clockBase = await $.clock.now()
    clockTick = scene.tick
  }

  /** @returns {Ctx} */
  const ctx = () => ({ rng, now: now(), available: hasSprite })

  /** @returns {{ $: Host, repo: import('./store/repo.js').Repo }} */
  function ready() {
    if (!host || !repo) throw new Error("Tokemon n'est pas démarré")
    return { $: host, repo }
  }

  /**
   * Annonce les événements (toasts) et déclenche les animations de la scène.
   * @param {GameEvent[]} events
   */
  function announce(events) {
    const { $ } = ready()
    for (const event of events) {
      if (event.type === 'level-up' && event.active) startJump(scene)
      if (event.type === 'evolved') startFlash(scene)
      if (event.type === 'captured') startBall(scene, true)
      if (event.type === 'throw-failed') startBall(scene, false)
    }
    toastEvents($, events)
    $.ui.invalidate('ui.render')
  }

  /**
   * Exécute une action du core dans une transaction, journalise et annonce ses événements.
   * @param {(save: Save, ctx: Ctx) => ActionResult} action
   * @returns {Promise<ActionResult>}
   */
  async function act(action) {
    const { $, repo } = ready()
    await syncClock($)
    const context = ctx()
    /** @type {GameEvent[]} */
    let upkeep = []
    const result = await repo.transact((save) => {
      upkeep = housekeeping(save, context)
      const outcome = action(save, context)
      logEvents(save, outcome.events, context.now)
      return outcome
    })
    announce([...upkeep, ...result.events])
    return result
  }

  /** Un tick d'animation : avance la scène, repeint la bande, fait l'entretien quand il est dû. */
  function tick() {
    if (!host || !repo) return
    const $ = host
    const save = repo.peek()
    if (!save) return
    const size = band.columns > 0 ? { columns: band.columns, rows: band.rows } : null
    const view = size && sceneView(save, scene, size)
    stepScene(scene, rng, view ? sceneLayout(view).room : 0)

    if (view && band.requestId) {
      if (band.surface === 'terminal') {
        const cells = toCells(composeScene(view))
        if (cells !== band.cells) {
          band.cells = cells
          // Un blit refusé (bande démontée, taille changée) redemande un dessin complet
          $.ui
            .blit({ requestId: band.requestId, key: RASTER_KEY, columns: band.columns, rows: band.rows, cells })
            .catch(() => $.ui.invalidate('ui.render'))
        }
      } else if (scene.tick % DESKTOP_REDRAW_TICKS === 0) {
        $.ui.invalidate('ui.render')
      }
    }

    if (scene.tick - clockTick >= CLOCK_SYNC_TICKS) void syncClock($).catch(() => undefined)
    if (!busy && needsHousekeeping(save, now())) {
      busy = true
      const context = ctx()
      repo
        .transact((fresh) => housekeeping(fresh, context))
        .then(announce)
        .catch(() => undefined)
        .finally(() => {
          busy = false
        })
    }
  }

  return {
    ready,
    act,
    now,
    ctx,
    scene,
    /** La dernière mesure de tokens, pour /tokemon debug tokens */
    lastReading: () => lastReading,
    isDebug: () => debug,

    /**
     * session.start : charge l'état, enregistre la commande, lance l'animation.
     * @param {Host} $
     */
    async start($) {
      host = $
      repo = createRepo($.store)
      await syncClock($)
      rng = createRng((clockBase ^ (clockBase / 4294967296)) >>> 0)
      registerSprites(GEN1_SPRITES)
      debug = (await $.env.get('TOKEMON_DEBUG')) === '1'
      await $.command.register({
        name: COMMAND_NAME,
        description: 'Tokemon : ton compagnon Pokémon nourri aux output tokens',
        argumentHint: '[start|switch|box|nick|help] …',
      })
      const save = await repo.transact((fresh) => {
        touchStreak(fresh, now())
        return fresh
      })
      if (!save.state.starterChosen) {
        $.ui.toast('Tokemon : choisis ton starter avec /tokemon start <bulbizarre|salamèche|carapuce|pikachu>')
      }
      timer?.cancel()
      timer = $.clock.every(TICK_MS, tick)
      $.ui.invalidate('ui.render')
    },

    /**
     * turn.complete : convertit les output tokens du tour en progression.
     * @param {Host} $
     * @param {import('./types.js').TurnEvent} e
     */
    async onTurn($, e) {
      if (!repo) return
      host = $
      await syncClock($)
      const reading = await getOutputTokens(e, { now: now() })
      lastReading = reading
      const context = ctx()
      // Sans identifiant de tour, la clé reste unique grâce à l'horodatage
      const key = `${e.agentId ?? 'main'}:${e.turnId ?? `${context.now}-${Math.floor(rng() * 1e9)}`}`
      const outcome = await repo.transact((save) =>
        applyTurn(save, { key, tokens: reading.tokens, approximate: reading.approximate }, context),
      )
      announce(outcome.events)
    },

    /**
     * ui.render de la bande.
     * @param {Host} $
     * @param {import('./types.js').RenderEvent} e
     * @returns {import('./types.js').UiNode | null} null pour laisser la bande à l'hôte
     */
    drawBand($, e) {
      const save = repo?.peek()
      if (!save || e.props.hasSurvey) return null
      host = $
      const size = sceneSize(e)
      const drawn = renderBand($.ui.resolve(e), e, { save, scene, now: now() })
      Object.assign(band, {
        requestId: drawn.cells !== null || drawn.svg !== null ? e.requestId : '',
        surface: e.surface,
        columns: size?.columns ?? 0,
        rows: size?.rows ?? 0,
        cells: drawn.cells ?? '',
        svg: drawn.svg ?? '',
      })
      return drawn.node
    },
  }
}

/** @typedef {ReturnType<typeof createApp>} App */
