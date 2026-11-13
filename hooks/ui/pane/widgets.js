// Petits éléments partagés par les onglets du panneau.

/**
 * Une ligne « ‹ Préc.  page 2/5  Suiv. › », ou rien quand il n'y a qu'une page.
 * @param {import('./index.js').PaneContext} context
 * @param {string} name préfixe des clés des boutons
 * @param {number} page page courante (à partir de 0)
 * @param {number} pages nombre de pages
 * @param {(page: number) => void} setPage
 * @returns {import('../../types.js').UiNode[]}
 */
export function pager({ elements }, name, page, pages, setPage) {
  const { Box, Text, Button } = elements
  if (pages <= 1 || !Box || !Text || !Button) return []
  return [
    Box({
      flexDirection: 'row',
      children: [
        Button({ key: name + '-prev', label: '‹ Préc.', onPress: () => setPage(Math.max(0, page - 1)) }),
        Text({ dimColor: true, children: [`  page ${page + 1}/${pages}  `] }),
        Button({ key: name + '-next', label: 'Suiv. ›', onPress: () => setPage(Math.min(pages - 1, page + 1)) }),
      ],
    }),
  ]
}

/**
 * @param {import('./index.js').PaneContext} context
 * @param {string[]} lines
 * @param {{ dim?: boolean, bold?: boolean }} [style]
 * @returns {import('../../types.js').UiNode[]}
 */
export function textLines({ elements }, lines, style = {}) {
  const { Text } = elements
  if (!Text) return []
  return lines.map((line) => Text({ dimColor: style.dim, bold: style.bold, children: [line || ' '] }))
}
