// import { fmtJSON } from "@sangervasi/common/dist/utils/fmt"
// import { guardJoin } from "@sangervasi/common/dist/messages/gnop"
import { fmtJSON } from "@sangervasi/common/lib/utils/fmt"
import { guardJoin } from "@sangervasi/common/lib/messages/gnop"
// import { fmtJSON } from "@sangervasi/common/utils/fmt"
// import { guardJoin } from "@sangervasi/common/messages/gnop"

const hello = () => {
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