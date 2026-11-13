import { throwBall } from '../core/capture.js'

/** @type {import('./index.js').Command} */
export const catchWild = {
  name: 'catch',
  usage: '/tokemon catch [ball]',
  about: 'Lancer une Ball sur le mon sauvage (poke, super, hyper, master)',
  async run(app, args) {
    return (await app.act((save, ctx) => throwBall(save, args, ctx))).message
  },
}
