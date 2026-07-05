"use client";

import {useMemo, useState} from "react";
import type {World} from "../../schemas/worldSchema";
import {createInitialGameState} from "../../engine/gameState";
import {lookAtRoom} from "../../engine/rooms";
import {runCommand} from "../../engine/commands";
import {OutputLog} from "./OutputLog";
import {CommandInput} from "./CommandInput";

type GamePlayerProps = {
	world: World;
	startingRoomId: string;
};

export function GamePlayer({world, startingRoomId}: GamePlayerProps) {
	const initialState = useMemo(() => {
		const state = createInitialGameState(world, startingRoomId);
		return lookAtRoom(world, state);
	}, [world, startingRoomId]);

	const [gameState, setGameState] = useState(initialState);
	const [command, setCommand] = useState("");

	function submitCommand(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!command.trim()) return;

		setGameState((currentState) => runCommand(world, currentState, command));
		setCommand("");
	}

	return (
		<section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-neutral-950 text-neutral-100">
			<div className="min-h-0 flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-3xl">
					<OutputLog messages={gameState.messages} />
				</div>
			</div>

			<CommandInput command={command} setCommand={setCommand} submitCommand={submitCommand} />
		</section>
	);
}
