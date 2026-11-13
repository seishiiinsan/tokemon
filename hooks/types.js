// Types JSDoc partagés : le sous-ensemble de l'API hôte ($) que Tokemon utilise.
// Isoler ce contrat ici permet de typer le stub de test et de limiter l'impact
// d'un changement de l'API des mods (encore instable) à register.js et ui/.

/**
 * @typedef {object} HostStore
 * @property {(key: string) => Promise<unknown>} get
 * @property {(key: string, value: unknown) => Promise<void>} set
 * @property {(key: string) => Promise<void>} delete
 * @property {() => Promise<string[]>} keys
 */

/**
 * @typedef {object} HostTimer
 * @property {() => void} cancel
 */

/**
 * @typedef {object} HostClock
 * @property {() => Promise<number>} now
 * @property {(ms: number, fn: () => void) => HostTimer} every
 * @property {(ms: number, fn: () => void) => HostTimer} after
 */

/**
 * @typedef {object} HttpResponse
 * @property {number} status
 * @property {boolean} ok
 * @property {Record<string, string>} headers
 * @property {string} text
 */

/** @typedef {unknown} UiNode */
/** @typedef {(props: Record<string, any>) => UiNode} UiElement */
/** @typedef {Record<string, UiElement | undefined>} UiElements */

/**
 * @typedef {object} HostUi
 * @property {(event: string) => void} invalidate
 * @property {(text: string) => void} toast
 * @property {(pane: { id: string, title?: string }) => Promise<{ isPlaced: boolean }>} open
 * @property {(pane: { id: string }) => Promise<void>} close
 * @property {(args: Record<string, unknown>) => Promise<unknown>} blit
 * @property {(e: RenderEvent) => UiElements} resolve
 */

/**
 * @typedef {object} Host
 * @property {HostStore} store
 * @property {HostClock} clock
 * @property {HostUi} ui
 * @property {{ register: (spec: { name: string, description: string, argumentHint?: string }) => Promise<unknown> }} command
 * @property {{ fetch: (url: string, init?: { headers?: Record<string, string> }) => Promise<HttpResponse> }} http
 * @property {{ read: (path: string) => Promise<string>, write: (path: string, text: string) => Promise<void>, exists: (path: string) => Promise<boolean> }} fs
 * @property {{ get: (name: string) => Promise<string | undefined> }} env
 * @property {{ name: string, root: string }} plugin
 */

/**
 * Usage d'un tour tel que l'hôte le rapporte (TurnUsage de l'API des mods).
 * @typedef {object} TurnUsage
 * @property {number} output_tokens
 * @property {number} [input_tokens]
 * @property {string} [model]
 */

/**
 * Payload de `turn.complete` (champs utilisés).
 * @typedef {object} TurnEvent
 * @property {string} [turnId]
 * @property {string} [agentId] absent sur la boucle principale, présent pour un subagent
 * @property {string} [answer]
 * @property {number} [durationMs]
 * @property {string} [reason]
 * @property {TurnUsage | null} [usage]
 */

/**
 * Entrée d'un hook `ui.render`.
 * @typedef {object} RenderEvent
 * @property {string} component
 * @property {string} surface 'terminal' | 'desktop' | 'vscode' | 'mobile'
 * @property {string} requestId
 * @property {Record<string, any>} props
 * @property {{ columns?: number, rows?: number }} [viewport]
 */

/**
 * @typedef {object} CommandEvent
 * @property {string} command
 * @property {string} args
 */

export {}
