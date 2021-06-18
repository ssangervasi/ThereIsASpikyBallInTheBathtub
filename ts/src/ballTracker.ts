import _ from 'lodash'

import {
	BallUpdate,
	guardBallUpdate,
} from '@sangervasi/common/lib/messages/gnop'

type M = typeof guardBallUpdate['M']

type S = {
	matches: number
	misses: number
	searches: number
	searchLen: number
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
		searches: 0,
		searchLen: 0,
	}

	summarize() {
		return `${this.percentMatches()}% matches, ${this.averageSearchLen()}`
	}

	percentMatches() {
		return Math.round(
			(100 * this.stats.matches) / (this.stats.matches + this.stats.misses),
		)
	}

	averageSearchLen() {
		return Math.round(this.stats.searchLen / this.stats.searches)
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
		const startIndex = _.sortedIndexBy(this.sent, m, u =>
			u === m ? m.sentAt! - this.opts.timeWindowMs : u.sentAt,
		)
		const endIndex = _.sortedIndexBy(this.sent, m, u =>
			u === m ? m.sentAt! + this.opts.timeWindowMs : u.sentAt,
		)

		this.stats.searches += 1
		for (let i = startIndex; i < endIndex && i < this.sent.length; i++) {
			this.stats.searchLen += 1

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

export const isWithin = (toMatch: number, windowSize: number, toTest: number) =>
	_.clamp(toTest, toMatch - windowSize, toMatch + windowSize) === toTest

export const clampLen = (a: Array<unknown>, len: number): void => {
	const excess = Math.max(0, a.length - len)
	a.splice(0, excess)
}
