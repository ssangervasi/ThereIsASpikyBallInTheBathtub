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
export class BallTracker {
	timeWindowMs = 1_000
	positionWindowPx = 120 * 2
	maxSentLen = 1_000

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
		console.log(
			`${Math.round(
				(100 * this.stats.matches) / (this.stats.matches + this.stats.misses),
			)}% matches `,
		)
	}

	trackSent(m: M) {
		this.sent.push(m)

		clampLen(this.sent, this.maxSentLen)
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

			// const diff: D = {
			// 	sentAt: sent.sentAt! - m.sentAt!,
			// 	x: sent.payload.position.x - m.payload.position.x,
			// 	y: sent.payload.position.y - m.payload.position.y,
			// 	matched: false,
			// }
			// this.stats.diffs.push(diff)

			// if (!this.isMsMatch(sent.sentAt!, m.sentAt!)) {
			// 	break
			// }

			if (this.isMatch(sent, m)) {
				// diff.matched = true
				return sent
			}
		}

		return undefined
	}

	private isMatch = (toMatch: M, toTest: M): boolean => {
		const matchPos = toMatch.payload.position
		const testPos = toTest.payload.position

		return (
			isWithin(toMatch.sentAt!, this.timeWindowMs, toTest.sentAt!) &&
			isWithin(matchPos.x, matchPos.dx, testPos.x) &&
			isWithin(matchPos.y, matchPos.dy, testPos.y)
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
