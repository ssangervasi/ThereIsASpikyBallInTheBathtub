import WebSocket from "ws"
import { Command } from 'commander'

import '../src/gnop'

// Trick the module that depends on a global browser implementation into using the node package.
Object.assign(globalThis, {
	WebSocket
})

const program = new Command()
program
	.option('--host <type>', 'Host', 'local')
	.option('--port <port>', 'Port', '42992')

const getHost = () => {
	const options =  program.opts()
	return options.host === 'remote' ? 'ws://sangervasi.net' : `ws://localhost:${options.port}`
}

program
	.command('echo')
	.action(async () => {
		const client = new Gnop.WsClient({
			host: getHost(),
			name: "Echo client"
		})

		await client.connect()

		setInterval(() => {
			client.speak()
		}, 2000)
	})


program
	.command('point')
	.action(async () => {
		const client = new Gnop.WsClient({
			host: getHost(),
			name: "Point client"
		})
		await client.connect()
		await client.join()

		for (let i = 0; i < 10; i++) {
			setTimeout(() => {
				client.point(i, i)
			}, i * 1000)
		}

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve(null)
			}, 11 * 1000)
		})

		client.ws?.close()
	})

program
	.command('listen')
	.action(async () => {
		const client = new Gnop.WsClient({
			host: getHost(),
			name: "Listen client"
		})
		await client.connect()
		await client.join()
	})

program.parse(process.argv)
