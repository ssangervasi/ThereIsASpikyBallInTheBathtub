import _ from 'lodash'

import {
	BallUpdate,
	guardBallUpdate,
} from '@sangervasi/common/lib/messages/gnop'

type M = typeof guardBallUpdate['M']

type S = {
	received: M
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
	maxSentLen = 128

	sent: Array<M> = []
	received: Array<M> = []

	stats: Array<S> = []

	trackSent(m: M) {
		this.sent.push(m)

		clampLen(this.sent, this.maxSentLen)
	}

	trackReceived(m: M): M | undefined {
		const match = this.matchReceived(m)
		if (!match) {
			this.received.push(m)
		}

		return match
	}

	private matchReceived(m: M): M | undefined {
		const nearestIndex = _.sortedIndexBy(this.sent, m, u => {
			u === m ? m.sentAt! - this.timeWindowMs : u.sentAt
		})
		const searchStart = _.clamp(nearestIndex - 1, 0, this.sent.length)

		const stat: S = {
			received: m,
			diffs: [],
		}
		this.stats.push(stat)

		for (let i = searchStart; i < this.sent.length; i++) {
			const sent = this.sent[i]

			const diff: D = {
				sentAt: sent.sentAt! - m.sentAt!,
				x: sent.payload.position.x - m.payload.position.x,
				y: sent.payload.position.y - m.payload.position.y,
				matched: false,
			}
			stat.diffs.push(diff)

			if (!this.isMsMatch(sent.sentAt!, m.sentAt!)) {
				break
			}

			if (this.isMatch(sent, m)) {
				diff.matched = true
				return sent
			}
		}

		return undefined
	}

	private isMatch = (toMatch: M, toTest: M): boolean => {
		const matchPos = toMatch.payload.position
		const testPos = toTest.payload.position
		// return (
		// 	this.isPxMatch(matchPos.x, testPos.x) &&
		// 	this.isPxMatch(matchPos.y, testPos.y)
		// )

		return (
			isWithin(matchPos.x, matchPos.dx, testPos.x) &&
			isWithin(matchPos.y, matchPos.dy, testPos.y)
		)
	}

	private isPxMatch = (toMatch: number, toTest: number): boolean =>
		isWithin(toMatch, this.positionWindowPx, toTest)

	private isMsMatch = (toMatch: number, toTest: number): boolean =>
		isWithin(toMatch, this.timeWindowMs, toTest)

	get(): M | undefined {
		const result = this.received.pop()
		this.received.splice(0)
		return result
	}
}

const isWithin = (toMatch: number, windowSize: number, toTest: number) =>
	_.clamp(toTest, toMatch - windowSize / 2, toMatch + windowSize / 2) === toTest

const clampLen = (a: Array<unknown>, len: number): void => {
	const excess = Math.max(0, a.length - len)
	a.splice(0, excess)
}
