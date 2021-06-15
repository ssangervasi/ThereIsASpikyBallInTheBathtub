import _ from 'lodash'

import { BallTracker } from '../src/ballTracker'

import {
	BallUpdate,
	guardBallUpdate,
	buildPosition,
} from '@sangervasi/common/dist/messages/gnop'

describe('BallTracker', () => {
	const sessionUuid = 'session'

	it('clamps the sent size', () => {
		const bt = new BallTracker()
		const excess = bt.maxSentLen * 2
		_.range(1, excess + 1).forEach(t => {
			bt.trackSent(
				guardBallUpdate.build({
					sentAt: t * 1000,
					sessionUuid,
					payload: {
						position: buildPosition({
							x: 100,
							y: 200,
						}),
					},
				}),
			)
		})

		expect(bt.sent.length).toEqual(bt.maxSentLen)
		expect(bt.sent[bt.sent.length - 1].sentAt).toEqual(excess * 1000)
	})

	const setupBt = () => {
		const bt = new BallTracker()

		bt.trackSent(
			guardBallUpdate.build({
				sentAt: 10_000,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 100,
						y: 200,
					}),
				},
			}),
		)
		bt.trackSent(
			guardBallUpdate.build({
				sentAt: 20_000,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 300,
						y: 400,
					}),
				},
			}),
		)
		bt.trackSent(
			guardBallUpdate.build({
				sentAt: 20_050,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 310,
						y: 410,
					}),
				},
			}),
		)
		bt.trackSent(
			guardBallUpdate.build({
				sentAt: 20_100,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 320,
						y: 430,
					}),
				},
			}),
		)
		bt.trackSent(
			guardBallUpdate.build({
				sentAt: 30_000,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 500,
						y: 600,
					}),
				},
			}),
		)

		return bt
	}

	it('finds an exact time & position match', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const matched = bt.trackReceived(
			guardBallUpdate.build({
				// Slightly greater than exact match b/c _.sortedIndexBy returns the lowest index.
				sentAt: toMatch.sentAt! + 1,
				sessionUuid,
				payload: {
					position: toMatch.payload.position,
				},
			}),
		)

		expect(matched).toEqual(toMatch)
	})

	it('finds a rough time match with exact position match', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const matched = bt.trackReceived(
			guardBallUpdate.build({
				sentAt: toMatch.sentAt! + 25,
				sessionUuid,
				payload: {
					position: toMatch.payload.position,
				},
			}),
		)

		expect(matched).toEqual(toMatch)
	})

	it('finds an exact time match with rough position match', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const matched = bt.trackReceived(
			guardBallUpdate.build({
				sentAt: toMatch.sentAt,
				sessionUuid,
				payload: {
					position: {
						...toMatch.payload.position,
						x: toMatch.payload.position.x + 8,
						y: toMatch.payload.position.y - 3,
					},
				},
			}),
		)

		expect(matched).toEqual(toMatch)
	})

	it('finds a rough time match with rough position match', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const matched = bt.trackReceived(
			guardBallUpdate.build({
				sentAt: toMatch.sentAt! + 25,
				sessionUuid,
				payload: {
					position: {
						...toMatch.payload.position,
						x: toMatch.payload.position.x + 8,
						y: toMatch.payload.position.y - 3,
					},
				},
			}),
		)

		expect(matched).toEqual(toMatch)
	})

	it('does not find a match with too rough a position', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const matched = bt.trackReceived(
			guardBallUpdate.build({
				sentAt: toMatch.sentAt! + 1,
				sessionUuid,
				payload: {
					position: {
						...toMatch.payload.position,
						x: toMatch.payload.position.x + 80,
						y: toMatch.payload.position.y - 30,
					},
				},
			}),
		)

		expect(matched).toEqual(undefined)
	})

	it('does not store the received message if it matched a sent message', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const m = guardBallUpdate.build({
			sentAt: toMatch.sentAt! + 25,
			sessionUuid,
			payload: {
				position: {
					...toMatch.payload.position,
					x: toMatch.payload.position.x + 8,
					y: toMatch.payload.position.y - 3,
				},
			},
		})

		bt.trackReceived(m)

		expect(bt.received).not.toContain(m)
	})

	it('stores the received message it did not match a sent message', () => {
		const bt = setupBt()
		const toMatch = bt.sent[2]

		const m = guardBallUpdate.build({
			sentAt: toMatch.sentAt! + 1,
			sessionUuid,
			payload: {
				position: {
					...toMatch.payload.position,
					x: toMatch.payload.position.x + 80,
					y: toMatch.payload.position.y - 30,
				},
			},
		})

		bt.trackReceived(m)

		expect(bt.received).toContain(m)
	})
})
