import { achievementLines } from '../ui/pane/achievements.js'

/** @type {import('./index.js').Command} */
export const achievements = {
  name: 'achievements',
  usage: '/tokemon achievements',
  about: 'Succès débloqués et à débloquer',
  async run(app) {
    return achievementLines(await app.ready().repo.load()).join('\n')
  },
}
