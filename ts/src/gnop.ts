import { guardEcho } from '@sangervasi/common/lib/messages/echo'
import {
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
import { parseMessage } from '@sangervasi/common/lib/messages/index'

type MetaPromise<T> = {
	promise: Promise<T>
	resolve: (value?: T) => void
	reject: (reason?: any) => void
}

const metafy = (): MetaPromise<unknown> => {
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

class WsClient {
	state: StateAny = {
		state: 'init',
	}

	promises: {
		connect?: MetaPromise<unknown>
		join?: MetaPromise<unknown>
	} = {}

	updates: Array<PlayerUpdate & { receivedAt: number}> = []

	constructor(
		public options: {
			host: string
			name?: string
		},
	) {}

	connect() {
		console.log('Connecting')
		const ws = new WebSocket(this.options.host)
		this.state = {
			state: 'creating',
			ws,
		}

		ws.onopen = this.handleOpen
		ws.onclose = this.handleClose
		ws.onerror = this.handleError
		ws.addEventListener('message', this.handleMessage)

		this.promises.connect = metafy()

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

		if (guardJoined.message(message)) {
			return this.handleJoined(message)
		}

		if (guardEcho.message(message)) {
			console.log('Client heard:', message)
			return
		}

		console.warn('Unhandled message:', message)
	}

	handleCreated = (message: typeof guardCreated['M']) => {
		if (this.state.state !== 'creating') {
			console.warn('Received created message while in state:', this.state.state)
			return
		}

		console.info('Created', message.sessionUuid)
		this.state = {
			...this.state,
			state: 'created',
			sessionUuid: message.sessionUuid,
		}
		this.promises.connect?.resolve()
	}

	handleJoined = (message: typeof guardJoined['M']) => {
		if (this.state.state !== 'joining') {
			console.warn('Received joined message while in state:', this.state.state)
			return
		}

		const { sessionUuid } = this.state
		console.log('Joined', sessionUuid)

		const self = message.payload.find(
			(player) => player.sessionUuid === sessionUuid,
		)
		const opponent = message.payload.find(
			(player) => player.sessionUuid !== sessionUuid,
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
		this.promises.join?.resolve()
	}

	handlePlayerUpdate = (message: typeof guardPlayerUpdate['M']) => {
		if (this.state.state !== 'joined') {
			console.warn('Received update message while in state:', this.state.state)
			return
		}

		this.state = {
			...this.state,
			opponent: message.payload.player
		}
		this.updates.push({
			receivedAt: Date.now(),
			...message.payload
		})
	}

	handleOpen = () => {
		console.info('Opened')
	}

	handleClose = () => {
		this.state = { state: 'init' }
		console.info('Closed')
	}

	handleError = () => {
		this.state = { state: 'init' }
		console.info('Errored')
	}

	join() {
		if (this.state.state !== 'created') {
			console.warn('Cannot join from state:', this.state)
			return
		}

		const mJoin = guardJoin.build({
			type: 'gnop.join',
			sessionUuid: this.state.sessionUuid,
			payload: {
				name: this.options.name || 'Name',
			},
		})

		console.info('Client joining:', mJoin)
		this.state = {
			...this.state,
			state: 'joining',
		}

		this.state.ws.send(JSON.stringify(mJoin))

		this.promises.join = metafy()
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

		console.info('Client joining:', m)
		this.state = {
			...this.state,
			state: 'joining',
		}

		this.state.ws.send(JSON.stringify(m))

		this.promises.join = metafy()
		return this.promises.join.promise
	}

	speak() {
		if (this.state.state !== 'created') {
			console.warn('Cannot speak from state:', this.state)
			return
		}

		const m = guardEcho.build({
			type: 'echo',
			sessionUuid: this.state.sessionUuid,
			payload: new Date().toISOString(),
		})

		console.info('Client speaking:', m)

		this.state.ws.send(JSON.stringify(m))
	}

	point(x: number, y: number) {
		if (this.state.state !== 'joined') {
			console.warn('Cannot send point from state:', this.state)
			return
		}

		const mPoint = guardPoint.build({
			type: 'gnop.point',
			sessionUuid: this.state.sessionUuid,
			payload: {
				x: x,
				y: y,
			},
		})

		console.info('Client sending point:', mPoint)

		this.state.ws.send(JSON.stringify(mPoint))
	}

	sendUpdate(position: Position) {
		if (this.state.state !== 'joined') {
			console.warn('Cannot send point from state:', this.state)
			return
		}

		const mPoint = guardPlayerUpdate.build({
			type: 'gnop.playerUpdate',
			sessionUuid: this.state.sessionUuid,
			payload: {
				player: this.state.self,
				position,
			},
		})

		console.info('Client sending point:', mPoint)

		this.state.ws.send(JSON.stringify(mPoint))
	}

	getUpdate() {
		return this.updates.shift()
	}
}

const GnopC = {
	WsClient,
} as const

Object.assign(globalThis, {
	Gnop: GnopC,
})

declare global {
	const Gnop: typeof GnopC
}
