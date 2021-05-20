import * as Messages from "@sangervasi/common/dist/messages"
import * as M from "@sangervasi/common/dist/utils/fmt"

export const hello = () => {
	return 'hi'
}

Messages.guard.type('horse')
