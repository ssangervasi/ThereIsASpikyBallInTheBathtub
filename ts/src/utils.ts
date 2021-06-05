import '@gdevelop/gdjs/Runtime/gd'
import '@gdevelop/gdjs/Runtime/runtimeobject'
import '@gdevelop/gdjs/Runtime/runtimegame'
import '@gdevelop/gdjs/Runtime/variable'
import '@gdevelop/gdjs/Runtime/types/global-types'
import '@gdevelop/gdjs/Runtime/force'
import '@gdevelop/gdjs/Runtime/gd-splash-image'
import '@gdevelop/gdjs/Runtime/inputmanager'
import '@gdevelop/gdjs/Runtime/jsonmanager'
import '@gdevelop/gdjs/Runtime/layer'
import '@gdevelop/gdjs/Runtime/oncetriggers'
import '@gdevelop/gdjs/Runtime/polygon'
import '@gdevelop/gdjs/Runtime/profiler'
import '@gdevelop/gdjs/Runtime/runtimebehavior'
import '@gdevelop/gdjs/Runtime/runtimescene'
import '@gdevelop/gdjs/Runtime/scenestack'
import '@gdevelop/gdjs/Runtime/spriteruntimeobject'
import '@gdevelop/gdjs/Runtime/timemanager'
import '@gdevelop/gdjs/Runtime/timer'
import '@gdevelop/gdjs/Runtime/variablescontainer'

import {
	BallUpdate,
	guardBallUpdate,
	guardDisconnected,
	guardJoin,
	guardJoined,
	guardPlayerUpdate,
	guardRejoin,
	Player,
	PlayerUpdate,
	Position,
} from '@sangervasi/common/lib/messages/gnop'

declare const eventsFunctionContext: EventsFunctionContext
declare const objects: gdjs.RuntimeObject[]

const handleUpdates = () => {
	const obj = objects[0]
	const vars = obj.getVariables()

	const opponentUpdateJsonVar = vars.get('OpponentUpdateJSON')
	const playerVar = vars.get('Player')

	const incomingUpdateVar = vars.get('IncomingUpdate')
	incomingUpdateVar.clearChildren()

	const latestUpdate: PlayerUpdate | null = JSON.parse(opponentUpdateJsonVar.getAsString())
	if (!latestUpdate) {
		return
	}

	const { player, position } = latestUpdate

	if (player.number !== playerVar.getAsNumber()) {
		return
	}

	const stateVar = incomingUpdateVar.getChild('State')
	const hpVar = incomingUpdateVar.getChild('HP')
	const xVar = incomingUpdateVar.getChild('X')
	const dxVar = incomingUpdateVar.getChild('DX')
	const yVar = incomingUpdateVar.getChild('Y')
	const dyVar = incomingUpdateVar.getChild('DY')
	const aVar = incomingUpdateVar.getChild('A')
	const daVar = incomingUpdateVar.getChild('DA')

	hpVar.getType()

	stateVar.setString('pending')
	xVar.setNumber(position.x)
	dxVar.setNumber(position.dx)
	yVar.setNumber(position.y)
	dyVar.setNumber(position.dy)
	aVar.setNumber(position.a)
	daVar.setNumber(position.da)

	const o = getChildren(incomingUpdateVar, { 'HP': 'hp', 'Y': 'y' })
}

type GV = string | number | boolean

const getChildren = <O extends Record<string, string>>(struct: gdjs.Variable, nameMap: O): Record<keyof O, GV> => {	
	type K = keyof O
	const res = {} as Record<K, GV> 
	Object.entries(nameMap).forEach((entry) => {
		const [k, dv] = entry as [K, V]
		const v = struct.getChild(k.toString()).getValue()
		res[k] = v
	})
	return res
}

const setChildren = <O extends Record<string, GV>>(struct: gdjs.Variable, nameMap: O): O => {	
	type K = keyof O
	type V = O[K]
	Object.entries(nameMap).forEach((entry) => {
		const [k, v] = entry as [K, V]
		struct.getChild(k.toString()).setValue(v)
	})
}
