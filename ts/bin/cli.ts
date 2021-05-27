import { Command } from 'commander'

import Gnop from '../src/gnop'

const program = new Command()
program
	.option('--host <type>', 'Host', 'local')
	.option('--port <port>', 'Port', '42992')

const getHost = (options: Record<string, unknown>) => {
	return options.host === 'remote' ? 'ws://sangervasi.net' : `ws://localhost:${options.port}`
}

program
	.command('echo')
	.action(async (options) => {
		const client = new Gnop.WsClient({
			host: getHost(options),
			name: "Echo client"
		})

		await client.connect()

		setInterval(() => {
			client.speak()
		}, 2000)
	})


program
	.command('point')
	.action(async (options) => {
		const client = new Gnop.WsClient({
			host: getHost(options),
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
	.command('listen <name>')
	.action(async (name: string, options) => {
		const client = new Gnop.WsClient({
			host: getHost(options),
			name: "Listen client"
		})
		await client.connect()
		await client.join()
	})

program.parse(process.argv)
