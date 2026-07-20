"use client";

import {useEffect, useRef, useState} from "react";
import type {World} from "../../schemas/world/worldSchema";
import {createInitialGameState} from "../../engine/states/createInitialState";
import {resolveTurn} from "../../engine/player/resolveTurn";
import {teleport} from "../../engine/player/teleport";
import {OutputLog} from "./OutputLog";
import {CommandInput} from "./CommandInput";
import {compareIds, idValue, type ID} from "../../utils/idUtils";
import "./GamePlayer.scss";

type GamePlayerProps = {
	isLoading?: boolean;
	world: World;
	startingRoomId: ID<"room">;
	teleportRequest?: GamePlayerTeleportRequest | null;
};

export type GamePlayerTeleportRequest = {
	id: number;
	roomId: ID<"room">;
};

export function GamePlayer({
	isLoading = false,
	world,
	startingRoomId,
	teleportRequest,
}: GamePlayerProps) {
	const resolvedStartingRoomId = world.rooms.some((room) => compareIds(room.id, startingRoomId))
		? startingRoomId
		: world.rooms[0]
			? world.rooms[0].id
			: null;

	return isLoading ? (
		<LoadingGamePlayer />
	) : resolvedStartingRoomId ? (
		<ActiveGamePlayer
			key={idValue(resolvedStartingRoomId)}
			world={world}
			startingRoomId={resolvedStartingRoomId}
			teleportRequest={teleportRequest}
		/>
	) : (
		<EmptyGamePlayer />
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

function EmptyGamePlayer() {
	return (
		<section className="game-player">
			<div className="game-player__output">
				<p>No rooms available. Add a room to begin exploring.</p>
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

function ActiveGamePlayer({
	world,
	startingRoomId,
	teleportRequest,
}: Omit<GamePlayerProps, "isLoading">) {
	const playerRef = useRef<HTMLElement | null>(null);
	const handledTeleportRequestRef = useRef<number | null>(null);
	const [gameState, setGameState] = useState(() => createInitialGameState(world, startingRoomId));
	const [currentCommandInHistory, setCurrentCommandInHistory] = useState<number>(0);
	const [commandList, setCommandList] = useState<string[]>([]);
	const [command, setCommand] = useState("");

	useEffect(() => {
		if (!teleportRequest || handledTeleportRequestRef.current === teleportRequest.id) return;

		handledTeleportRequestRef.current = teleportRequest.id;
		setGameState((currentState) => teleport(world, currentState, teleportRequest.roomId));
	}, [teleportRequest, world]);

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

	function submitCommand(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const trimmedCommand = command.trim();

		if (!trimmedCommand) return;

		setGameState((currentState) => resolveTurn(world, currentState, trimmedCommand));

		setCommandList((prevCommands) => [...prevCommands, trimmedCommand].slice(-20));
		setCommand("");
		setCurrentCommandInHistory(0);
	}

	return (
		<section ref={playerRef} className="game-player">
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
