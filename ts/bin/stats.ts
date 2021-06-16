import path from 'path'
import fs from 'fs'
import jsonStringify from 'json-stable-stringify'

const ROOT = path.resolve(__dirname, '../..')

type S = {
	received: {}
	diffs: Array<D>
}
type D = {
	sentAt: number
	x: number
	y: number
	matched: boolean
}

const main = () => {
	const inPath = path.resolve(ROOT, 'builds/stats.json')
	const outPath = path.resolve(ROOT, 'builds/stats.csv')

	const stats: S[] = JSON.parse(fs.readFileSync(inPath).toString())

	console.log('Writing')
	const outS = fs.createWriteStream(outPath)
	outS.write(`matched, x, y, sentAt\n`)

	stats.forEach(stat => {
		stat.diffs.forEach(diff => {
			outS.write(`${diff.matched}, ${diff.x}, ${diff.y}, ${diff.sentAt}\n`)
		})
	})

	outS.close()

	console.log('Written')
}

main()
