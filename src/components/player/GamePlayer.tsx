"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import type {World} from "../../schemas/world/worldSchema";
import {createInitialGameState} from "../../engine/states/createInitialState";
import type {GameState} from "@/schemas/states/gameStateSchema";
import {runCommand} from "../../engine/commands/execute";
import {OutputLog} from "./OutputLog";
import {CommandInput} from "./CommandInput";
import "./GamePlayer.scss";

type GamePlayerProps = {
	isLoading?: boolean;
	world: World;
	startingRoomId: string;
};

export function GamePlayer({isLoading = false, world, startingRoomId}: GamePlayerProps) {
	return isLoading ? (
		<LoadingGamePlayer />
	) : (
		<ActiveGamePlayer world={world} startingRoomId={startingRoomId} />
	);
}

function LoadingGamePlayer() {
	return (
		<section className="game-player" aria-busy="true">
			<div className="game-player__output">
				<OutputLog messages={[]} />
			</div>

			<CommandInput
				disabled
				command=""
				setCommand={() => {}}
				submitCommand={(event) => event.preventDefault()}
				commandList={[]}
				currentCommandInHistory={0}
				setCurrentCommandInHistory={() => {}}
			/>
		</section>
	);
}

function ActiveGamePlayer({world, startingRoomId}: Omit<GamePlayerProps, "isLoading">) {
	const playerRef = useRef<HTMLElement | null>(null);
	const initialState = useMemo(() => {
		const state = createInitialGameState(world, startingRoomId);
		// TODO make this a message
	}, [world, startingRoomId]);

	const [gameState, setGameState] = useState(initialState);
	const [currentCommandInHistory, setCurrentCommandInHistory] = useState<number>(0);
	const [commandList, setCommandList] = useState<string[]>([]);
	const [command, setCommand] = useState("");
	const displayState = useMemo(() => {
		// TODO refresh initial game state
	}, [world, gameState]);

	useEffect(() => {
		function blurCommandInputOutsidePlayer(event: PointerEvent) {
			const player = playerRef.current;
			if (!player || !(event.target instanceof Node) || player.contains(event.target)) return;

			const commandInput = player.querySelector<HTMLInputElement>(".command-input__field");
			if (commandInput && document.activeElement === commandInput) commandInput.blur();
		}

		document.addEventListener("pointerdown", blurCommandInputOutsidePlayer, true);
		return () => document.removeEventListener("pointerdown", blurCommandInputOutsidePlayer, true);
	}, []);

	function pushGameState(updateGameState: (currentState: GameState) => GameState) {
		// setGameState((currentState) => updateGameState(currentState));
	}

	function submitCommand(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmedCommand = command.trim();

		if (!trimmedCommand) return;

		pushGameState((currentState) => runCommand(world, currentState, trimmedCommand));

		setCommandList((prevCommands) => [...prevCommands, trimmedCommand].slice(-20));
		setCommand("");
		setCurrentCommandInHistory(0);
	}

	return (
		<section ref={playerRef} className="game-player">
			<div className="game-player__output">{/*<OutputLog messages={displayState.messages} />*/}</div>

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
