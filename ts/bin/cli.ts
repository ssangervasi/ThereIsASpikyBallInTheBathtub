#!/usr/bin/env ts-node
import { Command } from 'commander'
import WebSocket from 'ws'

import { guardEcho } from '@sangervasi/common/dist/messages/echo'
import {
	guardJoin,
	guardJoined,
	guardPoint,
} from '@sangervasi/common/dist/messages/gnop'
import {
	guardCreated,
} from '@sangervasi/common/dist/messages/session'
import {
	parseMessage,
} from '@sangervasi/common/dist/messages/index'

const PORT = Number(process.env.PORT) || 42992

const program = new Command()
program.option('--host <type>', 'Host', 'local')

const conn = async (options: Record<string, unknown>) => {
	const host =
		options.host === 'remote' ? 'ws://sangervasi.net' : `ws://localhost:${PORT}`

	console.log('Connecting')
	const ws = new WebSocket(host)

	ws.onopen = () => { console.log('Opened') }
	ws.onclose = () => { console.log('Closed') }
	ws.onerror = () => { console.log('Errored') }

	const p = new Promise<string>((resolve) => {
		const handleMessage = (event: { data: string }) => {
			const message = parseMessage(event.data)

			if (
				guardCreated.message(message)
			) {
				console.log('Connected', message.sessionUuid)
				ws.removeEventListener('message', handleMessage)
				resolve(message.sessionUuid)
			} else {
				console.log('Expected session, got:', message)
			}
		}

		ws.addEventListener('message', handleMessage)
	})

	const sessionUuid = await p
	return { ws, sessionUuid }
}

program
	.command('echo')
	.action(async (options) => {
		const { ws, sessionUuid } = await conn(options)

		setInterval(() => {
			console.log('client speaking:')
			const m = guardEcho.build({
				type: 'echo',
				sessionUuid,
				payload: new Date().toISOString(),
			})
			ws.send(JSON.stringify(m))
		}, 2000)

		ws.addEventListener('message', (event: { data: string }) => {
			const message = parseMessage(event.data)

			if (guardEcho.message(message)) {
				console.log('client heard:', message)
				return
			}
		})
	})

const join = async (c: { ws: WebSocket; sessionUuid: string }, name: string) => {
	console.log('Joining', c.sessionUuid)
	const mJoin = guardJoin.build({
		type: 'gnop.join',
		sessionUuid: c.sessionUuid,
		payload: {
			name,
		},
	})

	c.ws.send(JSON.stringify(mJoin))

	await new Promise((resolve) => {
		const handleJoined = (event: { data: string }) => {
			const message = parseMessage(event.data)
			if (guardJoined.message(message)) {
				console.log('Joined', c.sessionUuid)
				c.ws.removeEventListener('message', handleJoined)
				resolve(null)
			} else {
				console.log('Expected joined, got:', message)
			}
		}
		c.ws.addEventListener('message', handleJoined)
	})
}

program
	.command('point')
	.action(async (options) => {
		const c = await conn(options)
		await join(c, 'Send points')

		const s = (x: number, y: number) => {
			const mPoint = guardPoint.build({
				type: 'gnop.point',
				sessionUuid: c.sessionUuid,
				payload: {
					x: x,
					y: y,
				},
			})
			console.log('Sending', mPoint)
			c.ws.send(JSON.stringify(mPoint))
		}

		for (let i = 0; i < 10; i++) {
			setTimeout(() => {
				s(i, i)
			}, i * 1000)
		}

		await new Promise((resolve) => {
			setTimeout(() => {
				resolve(null)
			}, 11 * 1000)
		})

		c.ws.close()
	})

program
	.command('listen <name>')
	.action(async (name: string, options) => {
		const c = await conn(options)
		await join(c, 'Listener')

		c.ws.addEventListener('message', (event: { data: string }) => {
			const message = parseMessage(event.data)

			if (guardPoint.message(message)) {
				console.log('Received point:', message.payload)
			} else {
				console.log('Expected point, received:', message)
			}
		})
	})

program.parse(process.argv)
