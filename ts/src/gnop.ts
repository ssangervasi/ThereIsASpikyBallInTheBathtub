import WebSocket from 'ws'

import { guardEcho } from '@sangervasi/common/lib/messages/echo'
import {
	guardJoin,
	guardJoined,
	guardPoint,
} from '@sangervasi/common/lib/messages/gnop'
import { guardCreated } from '@sangervasi/common/lib/messages/session'
import { parseMessage } from '@sangervasi/common/lib/messages/index'

import { fmtJSON } from '@sangervasi/common/lib/utils/fmt'

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

class WsClient {
	ws?: WebSocket
	sessionUuid?: string
	state: "init" | "creating" | "created" | "joining" | "joined" = "init"
	
	promises: {
		connect?: MetaPromise<unknown>
		join?: MetaPromise<unknown>
	} = {}

	constructor(
		public options: {
			host: string
			name?: string
		},
	) { }

	async connect() {
		console.log('Connecting')
		const ws = new WebSocket(this.options.host)
		this.ws = ws

		ws.onopen = this.handleOpen
		ws.onclose = this.handleClose
		ws.onerror = this.handleError
		ws.addEventListener('message', this.handleMessage)

		this.state = "creating"

		this.promises.connect = metafy()

		return this.promises.connect
	}

	handleMessage = (event: { data: string }) => {
		const message = parseMessage(event.data)

		if (this.state === "creating") {
			if (guardCreated.message(message)) {
				console.info('Created', message.sessionUuid)
				this.state = "created"
				this.sessionUuid = message.sessionUuid
				this.promises.connect?.resolve()
			} else {
				console.warn('Expected created message, got:', message)
			}
			return
		}

		if (this.state === "joining") {
			if (guardJoined.message(message)) {
				console.log('Joined', this.sessionUuid)
				this.state = "joined"
				this.promises.join?.resolve()
			} else {
				console.warn('Expected joined message, got:', message)
			}
			return
		}

		if (guardEcho.message(message)) {
			console.log('client heard:', message)
			return
		}

		console.warn('Unhandled messag:', message)

	}

	handleOpen = () => {
		console.info('Opened')
	}

	handleClose = () => {
		this.state = 'init'
		console.info('Closed')
	}

	handleError = () => {
		this.state = 'init'
		console.info('Errored')
	}

	isReady(): this is { sessionUuid: string, ws: WebSocket } {
		return Boolean(this.sessionUuid)
			&& Boolean(this.ws)
			&& this.state === "created"
	}

	async join() {
		if (!this.isReady()) {
			console.warn('Cannot join from state:', this.state)
			return
		}
		

		const mJoin = guardJoin.build({
			type: 'gnop.join',
			sessionUuid: this.sessionUuid,
			payload: {
				name: this.options.name || "Name",
			},
		})

		console.info('Client joining:', mJoin)
		this.state = "joining"

		this.ws.send(JSON.stringify(mJoin))

		this.promises.join = metafy()
		return this.promises.join
	}

	speak() {
		if (!this.isReady()) {
			console.warn('Cannot speak from state:', this.state)
			return
		}

		const m = guardEcho.build({
			type: 'echo',
			sessionUuid: this.sessionUuid,
			payload: new Date().toISOString(),
		})

		console.info('Client speaking:', m)

		this.ws.send(JSON.stringify(m))
	}

	point(x: number, y: number) {
		if (!this.isReady()) {
			console.warn('Cannot send point from state:', this.state)
			return
		}

		const mPoint = guardPoint.build({
			type: 'gnop.point',
			sessionUuid: this.sessionUuid,
			payload: {
				x: x,
				y: y,
			},
		})

		console.info('Client sending point:', mPoint)

		this.ws.send(JSON.stringify(mPoint))
	}
}

const Gnop = {
	WsClient
} as const

export default Gnop

Object.assign(globalThis, {
	Gnop,
})
