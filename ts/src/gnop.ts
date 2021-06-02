import { sample } from "lodash"

import { guardEcho } from '@sangervasi/common/lib/messages/echo'
import {
	BallUpdate,
	guardBallUpdate,
	guardJoin,
	guardJoined,
	guardPlayerUpdate,
	guardPoint,
	guardRejoin,
	Player,
	PlayerUpdate,
	Position,
} from '@sangervasi/common/lib/messages/gnop'
import { guardCreated } from '@sangervasi/common/lib/messages/session'
import { Message, parseMessage } from '@sangervasi/common/lib/messages/index'

type MetaPromise<T> = {
	promise: Promise<T>
	resolve: (value?: T) => void
	reject: (reason?: any) => void
}

const metaPromise = (): MetaPromise<unknown> => {
	const meta: Partial<MetaPromise<unknown>> = {}
	meta.promise = new Promise((resolve, reject) => {
		meta.resolve = resolve
		meta.reject = reject
	})
	return meta as MetaPromise<unknown>
}

type StateInit = {
	state: 'init'
	ws?: WebSocket
}
type StateCreating = {
	state: 'creating'
	ws: WebSocket
}
type StateCreated = Omit<StateCreating, 'state'> & {
	state: 'created'
	sessionUuid: string
}
type StateJoining = Omit<StateCreated, 'state'> & {
	state: 'joining'
	self?: Player
	opponent?: Player
}
type StateJoined = Omit<StateJoining, 'state'> & {
	state: 'joined'
	self: Player
	opponent: Player
}
type StateAny =
	| StateInit
	| StateCreating
	| StateCreated
	| StateJoining
	| StateJoined

interface Options {
	host: string
	verbose: boolean
}

class WsClient {
	options = {
		host: 'ws://sangervasi.net',
		verbose: false,
	}

	state: StateAny = {
		state: 'init',
	}

	promises: {
		connect: MetaPromise<unknown>
		join: MetaPromise<unknown>
	} = {
		connect: metaPromise(),
		join: metaPromise()
	}

	playerUpdates: Array<PlayerUpdate & { receivedAt: number }> = []
	ballUpdates: Array<BallUpdate & { receivedAt: number }> = []

	constructor(options: Partial<Options>) {
		Object.assign(this.options, options)
	}

	connect() {
		this.info('Connecting')
		const ws = new WebSocket(this.options.host)
		this.state = {
			state: 'creating',
			ws,
		}

		ws.onopen = this.handleOpen
		ws.onclose = this.handleClose
		ws.onerror = this.handleError
		ws.addEventListener('message', this.handleMessage)

		return this.promises.connect.promise
	}

	isConnected(): boolean {
		return [
			'created',
			'joined',
			'joining',
		].includes(this.state.state)
	}

	handleMessage = (event: { data: string }) => {
		const message = parseMessage(event.data)

		if (guardCreated.message(message)) {
			return this.handleCreated(message)
		}

		if (guardJoined.message(message)) {
			return this.handleJoined(message)
		}

		if (guardPlayerUpdate.message(message)) {
			return this.handlePlayerUpdate(message)
		}

		if (guardBallUpdate.message(message)) {
			return this.handleBallUpdate(message)
		}

		console.warn('Unhandled message:', message)
	}

	handleCreated = (message: typeof guardCreated['M']) => {
		if (this.state.state !== 'creating') {
			console.warn('Received created message while in state:', this.state.state)
			return
		}

		this.info('Created', message.sessionUuid)
		this.state = {
			...this.state,
			state: 'created',
			sessionUuid: message.sessionUuid,
		}
		this.promises.connect.resolve()
	}

	handleJoined = (message: typeof guardJoined['M']) => {
		if (this.state.state !== 'joining') {
			console.warn('Received joined message while in state:', this.state.state)
			return
		}

		const { sessionUuid } = this.state
		this.info('Joined', sessionUuid)

		const self = message.payload.find(
			player => player.sessionUuid === sessionUuid,
		)
		const opponent = message.payload.find(
			player => player.sessionUuid !== sessionUuid,
		)

		this.state = {
			...this.state,
			self,
			opponent,
		}

		if (!(self && opponent)) {
			console.warn('Partially joined', message)
			return
		}

		this.state = {
			...this.state,
			state: 'joined',
			self,
			opponent,
		}
		this.promises.join.resolve()
	}

	handlePlayerUpdate = (message: typeof guardPlayerUpdate['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Received update message while in state:', this.state.state)
			return
		}

		this.info('Received player update', message.payload)
		this.state.opponent = message.payload.player
		this.playerUpdates.push({
			receivedAt: Date.now(),
			...message.payload,
		})
	}

	handleBallUpdate = (message: typeof guardBallUpdate['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Received update message while in state:', this.state.state)
			return
		}

		this.info('Received ball update', message.payload)
		this.ballUpdates.push({
			receivedAt: Date.now(),
			...message.payload
		})
	}

	handleOpen = () => {
		this.info('Opened')
	}

	handleClose = () => {
		this.state = { state: 'init' }
		console.warn('Closed')
	}

	handleError = () => {
		this.state = { state: 'init' }
		console.error('Errored')
	}

	join(name?: string) {
		if (this.state.state !== 'created') {
			console.warn('Cannot join from state:', this.state)
			return
		}

		const m = guardJoin.build({
			type: 'gnop.join',
			sessionUuid: this.state.sessionUuid,
			payload: {
				name: name || 'Name',
			},
		})

		this.info('Client joining:', m)
		this.state = {
			...this.state,
			state: 'joining',
		}

		this.send(m)

		return this.promises.join.promise
	}

	rejoin(previousSessionUuid: string) {
		if (this.state.state !== 'created') {
			console.warn('Cannot join from state:', this.state)
			return
		}

		const m = guardRejoin.build({
			type: 'gnop.rejoin',
			sessionUuid: this.state.sessionUuid,
			payload: {
				previousSessionUuid,
			},
		})

		this.info('Client joining:', m)
		this.state = {
			...this.state,
			state: 'joining',
		}

		this.send(m)

		return this.promises.join.promise
	}

	sendPlayerUpdate(position: Position) {
		if (this.state.state !== 'joined') {
			console.warn('Cannot send player from state:', this.state)
			return
		}

		const m = guardPlayerUpdate.build({
			type: 'gnop.playerUpdate',
			sessionUuid: this.state.sessionUuid,
			payload: {
				player: this.state.self,
				position,
			},
		})

		this.send(m)
	}

	getPlayerUpdate() {
		return this.playerUpdates.shift()
	}

	sendBallUpdate(position: Position) {
		if (this.state.state !== 'joined') {
			console.warn('Cannot send ball from state:', this.state)
			return
		}

		const m = guardBallUpdate.build({
			type: 'gnop.ballUpdate',
			sessionUuid: this.state.sessionUuid,
			payload: {
				position,
			},
		})

		this.send(m)
	}

	getBallUpdate() {
		return this.ballUpdates.shift()
	}

	private send(m: Message<string, unknown>) {
		if (!this.state.ws) {
			console.warn('Cannot data without websocket:', this.state)
			return
		}

		this.info('Client sending message:', m)

		this.state.ws.send(JSON.stringify(m))
	}

	private info(...args: any[]) {
		if (!this.options.verbose) {
			return
		}
		console.info(...args)
	}
}

const NAMES = [
	'Air Freshener',
	'Bath',
	'Bathmat',
	'Bidet',
	'Bleach',
	'Body Wash',
	'Bubble Bath',
	'Conditioner',
	'Faucet',
	'Floss',
	'Loofah',
	'Lotion',
	'Plunger',
	'Razor',
	'Rubber Ducky',
	'Shampoo',
	'Sink',
	'Soap',
	'Toilet Paper',
	'Toothbrush',
	'Towel',
]
const generateName = () => {
	sample(NAMES)
}

const GnopC = {
	WsClient,
	generateName,
} as const

Object.assign(globalThis, {
	Gnop: GnopC,
})

declare global {
	const Gnop: typeof GnopC
}
