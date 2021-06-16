import _ from 'lodash'

import {
	BallUpdate,
	guardBallUpdate,
	guardDisconnected,
	guardJoin,
	guardJoined,
	guardPlayerUpdate,
	guardRejoin,
	Player,
	PlayerUpdate,
	Position,
} from '@sangervasi/common/lib/messages/gnop'
import { guardCreated } from '@sangervasi/common/lib/messages/session'
import { Message, parseMessage } from '@sangervasi/common/lib/messages/index'

import { BallTracker } from './ballTracker'

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
	sessionUuid?: string
}
type StateCreating = Omit<StateInit, 'state'> & {
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

	name = generateName()

	state: StateAny = {
		state: 'init',
	}

	promises: {
		connect: MetaPromise<unknown>
		join: MetaPromise<unknown>
	} = {
		connect: metaPromise(),
		join: metaPromise(),
	}

	playerUpdates: Array<PlayerUpdate> = []
	ballTracker = new BallTracker()

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

	handleMessage = (event: { data: string }) => {
		const message = parseMessage(event.data)

		if (guardCreated.message(message)) {
			return this.handleCreated(message)
		}

		if (guardJoined.message(message)) {
			return this.handleJoined(message)
		}

		if (guardDisconnected.message(message)) {
			return this.handleDisconnected(message)
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

		const { self, opponent } = this.findPlayers(message.payload)
		this.state = {
			...this.state,
			self,
			opponent,
		}

		if (!(self && opponent)) {
			console.warn('Partially joined', message)
			return
		}

		this.info('Joined', message)

		this.state = {
			...this.state,
			state: 'joined',
			self,
			opponent,
		}
		this.promises.join.resolve()
	}

	handleDisconnected = (message: typeof guardDisconnected['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Disconnected while not joined')
			return
		}

		const { self, opponent } = this.findPlayers(message.payload)
		if (!(self && opponent)) {
			console.warn('Disconnected without self & opponent')
			return
		}

		this.state = {
			...this.state,
			self,
			opponent,
		}
	}

	handlePlayerUpdate = (message: typeof guardPlayerUpdate['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Received update message while in state:', this.state.state)
			return
		}

		this.info('Received player update', message.payload)
		this.state.opponent = message.payload.player
		// this.playerUpdates = []
		this.playerUpdates.push(message.payload)
	}

	handleBallUpdate = (message: typeof guardBallUpdate['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Received update message while in state:', this.state.state)
			return
		}

		this.info('Received ball update', message.payload)
		this.ballTracker.trackReceived(message)
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

	isConnected(): this is { state: StateCreated | StateJoined | StateJoining } {
		return ['created', 'joined', 'joining'].includes(this.state.state)
	}

	isOpponentDisconnected(): boolean {
		if (this.state.state !== 'joined') {
			return false
		}
		return this.state.opponent.state === 'disconnected'
	}

	findPlayers(players: Player[]): { self?: Player; opponent?: Player } {
		const { sessionUuid } = this.state
		if (!sessionUuid) {
			return {}
		}

		const self = players.find(player => player.sessionUuid === sessionUuid)
		const opponent = players.find(player => player.sessionUuid !== sessionUuid)
		return { self, opponent }
	}

	join(name?: string) {
		if (this.state.state !== 'created') {
			console.warn('Cannot join from state:', this.state)
			return
		}

		if (name) {
			this.name = name
		}

		const m = guardJoin.build({
			type: 'gnop.join',
			sessionUuid: this.state.sessionUuid,
			payload: {
				name: this.name,
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

	disconnect() {
		if (!this.state.ws) {
			return
		}
		this.state.ws.close()
	}

	sendPlayerUpdate(payload: PlayerUpdate) {
		if (this.state.state !== 'joined') {
			console.warn('Cannot send player from state:', this.state)
			return
		}

		this.state.self.hp = payload.player.hp

		const m = guardPlayerUpdate.build({
			type: 'gnop.playerUpdate',
			sessionUuid: this.state.sessionUuid,
			payload: {
				player: this.state.self,
				position: payload.position,
			},
		})

		this.send(m)
	}

	getPlayerUpdate(): PlayerUpdate | undefined {
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

		this.ballTracker.trackSent(m)
		this.send(m)
	}

	getBallUpdate(): BallUpdate | undefined {
		const m = this.ballTracker.get()
		return m?.payload
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
] as const
const generateName = (): string => {
	return _.sample(NAMES) || NAMES[0]
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
