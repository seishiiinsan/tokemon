/** @type {import('./index.js').Command} */
export const pane = {
  name: 'pane',
  usage: '/tokemon pane [onglet]',
  about: 'Ouvrir/fermer le panneau (équipe, sac, dex, succès, stats)',
  async run(app, args) {
    const { repo } = app.ready()
    const wanted = args.trim().toLowerCase()
    /** @type {Record<string, import('../ui/pane/index.js').PaneTab>} */
    const names = {
      equipe: 'team',
      équipe: 'team',
      box: 'team',
      team: 'team',
      sac: 'bag',
      bag: 'bag',
      dex: 'dex',
      pokedex: 'dex',
      pokédex: 'dex',
      succes: 'achievements',
      succès: 'achievements',
      achievements: 'achievements',
      stats: 'stats',
    }
    if (wanted) {
      const tab = names[wanted]
      if (!tab) return `Onglet inconnu : « ${wanted} ». Onglets : équipe, sac, dex, succès, stats.`
      app.paneView.tab = tab
      return (await app.setPane(true))
        ? 'Panneau Tokemon ouvert.'
        : "Panneau demandé : il s'affichera dès que la fenêtre aura la place."
    }
    const open = (await repo.load()).state.paneOpen
    if (open) {
      await app.setPane(false)
      return 'Panneau Tokemon fermé.'
    }
    return (await app.setPane(true))
      ? 'Panneau Tokemon ouvert.'
      : "Panneau demandé : il s'affichera dès que la fenêtre aura la place."
  },
}
