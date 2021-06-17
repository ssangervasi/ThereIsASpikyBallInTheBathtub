import _ from 'lodash'

import {
	BallUpdate,
	guardBallUpdate,
} from '@sangervasi/common/lib/messages/gnop'

type M = typeof guardBallUpdate['M']

type S = {
	matches: number
	misses: number
	diffs: Array<D>
}
type D = {
	sentAt: number
	x: number
	y: number
	matched: boolean
}

export type Opts = {
	timeWindowMs: number
	maxSentLen: number
}
export class BallTracker {
	opts: Opts = {
		timeWindowMs: 1_000,
		maxSentLen: 1_000,
	}

	constructor(opts: Partial<Opts> = {}) {
		this.opts = {
			...this.opts,
			...opts,
		}
	}

	sent: Array<M> = []
	received: Array<M> = []

	stats: S = {
		matches: 0,
		misses: 0,
		diffs: [],
	}

	summarize() {
		console.log(`matches : misses `)
		console.log(`${this.stats.matches} : ${this.stats.misses} `)
		console.log(`${this.percentMatches()}% matches `)
	}

	percentMatches() {
		return (
			100 *
			Math.round(this.stats.matches / (this.stats.matches + this.stats.misses))
		)
	}

	trackSent(m: M) {
		this.sent.push(m)

		clampLen(this.sent, this.opts.maxSentLen)
	}

	trackReceived(m: M): M | undefined {
		const match = this.matchReceived(m)
		if (match) {
			this.stats.matches += 1
		} else {
			this.stats.misses += 1
			this.received.push(m)
		}

		return match
	}

	private matchReceived(m: M): M | undefined {
		// const nearestIndex = _.sortedIndexBy(this.sent, m, u => {
		// 	u === m ? m.sentAt! - this.timeWindowMs : u.sentAt
		// })
		// const searchStart = _.clamp(nearestIndex - 1, 0, this.sent.length)
		const searchStart = 0

		for (let i = searchStart; i < this.sent.length; i++) {
			const sent = this.sent[i]

			if (this.isMatch(sent, m)) {
				return sent
			}
		}

		return undefined
	}

	private isMatch = (toMatch: M, toTest: M): boolean => {
		const matchPos = toMatch.payload.position
		const testPos = toTest.payload.position
		const sec = this.opts.timeWindowMs / 1000

		return (
			isWithin(toMatch.sentAt!, this.opts.timeWindowMs, toTest.sentAt!) &&
			isWithin(matchPos.x, matchPos.dx * sec, testPos.x) &&
			isWithin(matchPos.y, matchPos.dy * sec, testPos.y)
		)
	}

	get(): M | undefined {
		const result = this.received.pop()
		this.received.splice(0)
		return result
	}
}

const isWithin = (toMatch: number, windowSize: number, toTest: number) =>
	_.clamp(toTest, toMatch - windowSize, toMatch + windowSize) === toTest

const clampLen = (a: Array<unknown>, len: number): void => {
	const excess = Math.max(0, a.length - len)
	a.splice(0, excess)
}
