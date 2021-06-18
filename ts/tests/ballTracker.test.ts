import _ from 'lodash'

import { BallTracker } from '../src/ballTracker'

import {
	BallUpdate,
	guardBallUpdate,
	buildPosition,
} from '@sangervasi/common/dist/messages/gnop'

describe('BallTracker', () => {
	const sessionUuid = 'session'

	describe('.trackSent', () => {
		it('clamps the sent size', () => {
			const bt = new BallTracker()
			const excess = bt.opts.maxSentLen * 2
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

			expect(bt.sent.length).toEqual(bt.opts.maxSentLen)
			expect(bt.sent[bt.sent.length - 1].sentAt).toEqual(excess * 1000)
		})
	})

	describe('.trackReceived', () => {
		const setupBt = () => {
			const bt = new BallTracker()

			bt.trackSent(
				guardBallUpdate.build({
					sentAt: 10_000,
					sessionUuid,
					payload: {
						position: buildPosition({
							x: 100,
							dx: 10,
							y: 200,
							dy: 10,
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
							dx: 0,
							y: 400,
							dy: 0,
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
							x: 310,
							dx: 10,
							y: 410,
							dy: 10,
						}),
					},
				}),
			)
			bt.trackSent(
				guardBallUpdate.build({
					sentAt: 22_200,
					sessionUuid,
					payload: {
						position: buildPosition({
							x: 320,
							dx: 10,
							y: 430,
							dy: 10,
						}),
					},
				}),
			)
			bt.trackSent(
				guardBallUpdate.build({
					sentAt: 22_300,
					sessionUuid,
					payload: {
						position: buildPosition({
							x: 400,
							dx: 100,
							y: 400,
							dy: 100,
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
							dx: 10,
							y: 600,
							dy: 10,
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
					sentAt: toMatch.sentAt,
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

		it('searches through many to find a rough time', () => {
			const bt = setupBt()
			const toMatch = guardBallUpdate.build({
				sentAt: 22_300,
				sessionUuid,
				payload: {
					position: buildPosition({
						x: 400,
						dx: 100,
						y: 400,
						dy: 100,
					}),
				},
			})

			const matched = bt.trackReceived(
				guardBallUpdate.build({
					sentAt: 22_000,
					sessionUuid,
					payload: {
						position: buildPosition({
							x: 499,
							dx: 100,
							y: 499,
							dy: 100,
						}),
					},
				}),
			)

			expect(matched).toEqual(toMatch)
			expect(bt.stats.searchLen).toEqual(2)
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

		it('does not store the received message when it matches a sent message', () => {
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

		it('stores the received message when it does not match a sent message', () => {
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

	describe('.get', () => {
		const n = 10
		const setupBt = () => {
			const bt = new BallTracker()
			_.range(1, n + 1).forEach(t => {
				bt.trackReceived(
					guardBallUpdate.build({
						sentAt: t * 1000,
						sessionUuid,
						payload: {
							position: buildPosition({}),
						},
					}),
				)
			})
			return bt
		}

		it('returns the last entry', () => {
			const bt = setupBt()
			expect(bt.received.length).toEqual(n)

			const got = bt.get()
			expect(got).toMatchObject({ sentAt: n * 1000 })
		})

		it('clears out any earlier entries', () => {
			const bt = setupBt()
			expect(bt.received.length).toEqual(n)

			bt.get()
			expect(bt.received.length).toEqual(0)
		})
	})
})
