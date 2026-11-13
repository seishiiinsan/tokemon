import { bandLines } from '../band.js'
import { achievementsTab } from './achievements.js'
import { bagTab } from './bag.js'
import { dexTab } from './dex.js'
import { statsTab } from './stats.js'
import { teamTab } from './team.js'

// Le panneau latéral : une rangée d'onglets, puis le contenu de l'onglet courant.
// Réduit en widget (desktop), il ne montre que l'essentiel.

/** @typedef {'team' | 'bag' | 'dex' | 'achievements' | 'stats'} PaneTab */

/**
 * L'état d'affichage du panneau (propre à la session).
 * @typedef {object} PaneView
 * @property {PaneTab} tab
 * @property {number} boxPage
 * @property {number} dexPage
 */

/**
 * @typedef {object} PaneActions
 * @property {(tab: PaneTab) => void} setTab
 * @property {(page: number) => void} setBoxPage
 * @property {(page: number) => void} setDexPage
 * @property {(monId: number) => void} switchTo
 */

/**
 * @typedef {object} PaneContext
 * @property {import('../../types.js').UiElements} elements
 * @property {import('../../types.js').RenderEvent} e
 * @property {import('../../store/schema.js').Save} save
 * @property {number} now
 * @property {PaneView} view
 * @property {PaneActions} actions
 */

/** @type {{ id: PaneTab, label: string, draw: (context: PaneContext) => import('../../types.js').UiNode[] }[]} */
export const TABS = [
  { id: 'team', label: 'Équipe', draw: teamTab },
  { id: 'bag', label: 'Sac', draw: bagTab },
  { id: 'dex', label: 'Pokédex', draw: dexTab },
  { id: 'achievements', label: 'Succès', draw: achievementsTab },
  { id: 'stats', label: 'Stats', draw: statsTab },
]

/** @returns {PaneView} */
export const createPaneView = () => ({ tab: 'team', boxPage: 0, dexPage: 0 })

/**
 * @param {PaneContext} context
 * @returns {import('../../types.js').UiNode}
 */
export function renderPane(context) {
  const { elements, e, save, now, view, actions } = context
  const { Box, Text, Button } = elements
  if (!Box || !Text) throw new Error('La surface ne fournit ni Box ni Text')

  if (e.props.placement === 'widget') {
    return Box({
      flexDirection: 'column',
      children: bandLines(save, now)
        .slice(0, 3)
        .map((line) => Text({ bold: line.bold, dimColor: line.dim, wrap: 'truncate-end', children: [line.text] })),
    })
  }

  const tab = TABS.find((candidate) => candidate.id === view.tab) ?? TABS[0]
  const tabs = TABS.map((candidate, index) =>
    Button
      ? Button({
          key: 'tab-' + candidate.id,
          label: candidate.label,
          hotkey: String(index + 1),
          variant: candidate.id === tab.id ? 'primary' : 'secondary',
          onPress: () => actions.setTab(candidate.id),
        })
      : Text({ bold: candidate.id === tab.id, children: [candidate.label + ' '] }),
  )
  return Box({
    flexDirection: 'column',
    children: [
      Box({ flexDirection: 'row', flexWrap: 'wrap', children: tabs }),
      Text({ children: [' '] }),
      ...tab.draw(context),
    ],
  })
}
