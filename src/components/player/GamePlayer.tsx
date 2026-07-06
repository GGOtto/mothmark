"use client";

import {useMemo, useState} from "react";
import type {World} from "../../schemas/worldSchema";
import {createInitialGameState} from "../../engine/gameState";
import {lookAtRoom} from "../../engine/rooms";
import {runCommand} from "../../engine/commands";
import {OutputLog} from "./OutputLog";
import {CommandInput} from "./CommandInput";
import "./GamePlayer.scss";

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
	const [currentCommandInHistory, setCurrentCommandInHistory] = useState<number>(0);
	const [commandList, setCommandList] = useState<string[]>([]);
	const [command, setCommand] = useState("");

	function submitCommand(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!command.trim()) return;

		setGameState((currentState) => runCommand(world, currentState, command));
		setCommandList((prevCommands) => [...prevCommands, command].slice(-20));
		setCommand("");
		setCurrentCommandInHistory(0);
	}

	return (
		<section className="game-player">
			<div className="game-player__output">
				<OutputLog messages={gameState.messages} />
			</div>

			<CommandInput
				command={command}
				setCommand={setCommand}
				submitCommand={submitCommand}
				commandList={commandList}
				currentCommandInHistory={currentCommandInHistory}
				setCurrentCommandInHistory={setCurrentCommandInHistory}
			/>
		</section>
	);
}
