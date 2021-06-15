import _ from 'lodash'

import {
	BallUpdate,
	guardBallUpdate,
} from '@sangervasi/common/lib/messages/gnop'

type M = typeof guardBallUpdate['M']

export class BallTracker {
	timeWindowMs = 100
	positionWindowPx = 20
	maxSentLen = 128

	sent: Array<M> = []
	received: Array<M> = []

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
		const nearestIndex = _.sortedIndexBy(this.sent, m, 'sentAt')
		const searchStart = _.clamp(nearestIndex - 1, 0, this.sent.length)

		for (let i = searchStart; i < this.sent.length; i++) {
			const sent = this.sent[i]
			if (!this.isMsMatch(m.sentAt!, sent.sentAt!)) {
				break
			}

			if (this.isMatch(m, sent)) {
				return sent
			}
		}

		return undefined
	}

	private isMatch = (toMatch: M, toTest: M): boolean => {
		const matchPos = toMatch.payload.position
		const testPos = toTest.payload.position
		return (
			this.isPxMatch(matchPos.x, testPos.x) &&
			this.isPxMatch(matchPos.y, testPos.y)
		)
	}

	private isPxMatch = (toMatch: number, toTest: number): boolean => {
		return (
			_.clamp(
				toTest,
				toMatch - this.positionWindowPx / 2,
				toMatch + this.positionWindowPx / 2,
			) === toTest
		)
	}

	private isMsMatch = (toMatch: number, toTest: number): boolean => {
		return (
			_.clamp(
				toTest,
				toMatch - this.timeWindowMs / 2,
				toMatch + this.timeWindowMs / 2,
			) === toTest
		)
	}

	get(): M | undefined {
		return this.received.shift()
	}
}

const clampLen = (a: Array<unknown>, len: number): void => {
	const excess = Math.max(0, a.length - len)
	a.splice(0, excess)
}
