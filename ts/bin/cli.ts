import WebSocket from 'ws'
import { Command } from 'commander'

import '../src/gnop'
import { buildPosition } from '@sangervasi/common/lib/messages/gnop'

// Trick the module that depends on a global browser implementation into using the node package.
Object.assign(globalThis, {
	WebSocket,
})

const program = new Command()
program
	.option('--net <net>', 'Host', 'local')
	.option('--port <port>', 'Port', '42992')
	.option('--session [uuid]', 'Session')

const getOpts = () => {
	const opts = program.opts()
	const host =
		opts.net === 'remote'
			? 'ws://sangervasi.net'
			: `ws://localhost:${opts.port}`
	return {
		host,
		session: typeof opts.session === 'string' ? opts.session : undefined,
	}
}

program.command('ballUpdates').action(async () => {
	const opts = getOpts()
	const client = new Gnop.WsClient({
		host: getOpts().host,
		verbose: true,
	})
	await client.connect()

	if (opts.session) {
		await client.rejoin(opts.session)
	} else {
		await client.join()
	}

	for (let i = 0; i < 10; i++) {
		setTimeout(() => {
			client.sendBallUpdate(buildPosition({
				x: i,
				y: i,
			}))
		}, i * 1000)
	}

	await new Promise(resolve => {
		setTimeout(() => {
			resolve(null)
		}, 11 * 1000)
	})

	client.state.ws?.close()
})

program.command('listen').action(async () => {
	const client = new Gnop.WsClient({
		host: getOpts().host,
		verbose: true,
	})
	await client.connect()
	await client.join()

	const iid = setInterval(() => {
		if (client.isOpponentDisconnected()) {
			console.log('Opponent disconnected')
			clearInterval(iid)
			client.state.ws?.close()
		}
	}, 1000)
})

program.parse(process.argv)
