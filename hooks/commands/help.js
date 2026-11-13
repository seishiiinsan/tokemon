/**
 * @param {() => import('./index.js').Command[]} list les commandes, lues à l'appel
 * @returns {import('./index.js').Command}
 */
export const createHelp = (list) => ({
  name: 'help',
  usage: '/tokemon help',
  about: 'Aide',
  async run(app) {
    const commands = list().filter((command) => !command.debugOnly || app.isDebug())
    const width = Math.max(...commands.map((command) => command.usage.length))
    return [
      'Tokemon : commandes',
      ...commands.map((command) => `${command.usage.padEnd(width)}  ${command.about}`),
    ].join('\n')
  },
})
