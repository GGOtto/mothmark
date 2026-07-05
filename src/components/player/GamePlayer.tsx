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

		setGameState((currentState) => runCommand(world, currentState, command));
		setCommand("");
	}

	return (
		<main className="flex min-h-screen flex-col bg-neutral-950 text-neutral-100">
			<section className="flex-1 overflow-y-auto p-6">
				<div className="mx-auto max-w-3xl">
					<OutputLog messages={gameState.messages} />
				</div>
			</section>

			<CommandInput command={command} setCommand={setCommand} submitCommand={submitCommand} />
		</main>
	);
}
