import { fmtJSON } from "@sangervasi/common/dist/utils/fmt"
import {
	guardJoin
} from "@sangervasi/common/dist/messages/gnop"

export const hello = () => {
	const m = guardJoin.build({
		type: "gnop.join",
		sessionUuid: "asdf",
		payload: {
			name: "Jorsh"
		}
	})
	return fmtJSON(m)
}


const Gnop = {
	hello
} as const

Object.assign(
	globalThis, {
		Gnop
	}
)