"use client";

import {useEffect, useRef, useState} from "react";
import type {World} from "../../schemas/world/worldSchema";
import {createInitialGameState} from "../../engine/states/createInitialState";
import {resolveTurn} from "../../engine/player/resolveTurn";
import {teleport} from "../../engine/player/teleport";
import {PlayerTerminal} from "./PlayerTerminal";
import {compareIds, idValue, type ID} from "../../utils/idUtils";
import "./GamePlayer.scss";

type GamePlayerProps = {
	isLoading?: boolean;
	world: World;
	startingRoomId: ID<"room">;
	teleportRequest?: GamePlayerTeleportRequest | null;
	onCurrentRoomChange?: (roomId: ID<"room">) => void;
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
	onCurrentRoomChange,
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
			onCurrentRoomChange={onCurrentRoomChange}
		/>
	) : (
		<EmptyGamePlayer />
	);
}

function LoadingGamePlayer() {
	return (
		<PlayerTerminal
			disabled
			command=""
			messages={[]}
			onCommandChange={() => {}}
			onSubmit={() => {}}
		/>
	);
}

function EmptyGamePlayer() {
	return (
		<PlayerTerminal
			disabled
			command=""
			messages={[
				{id: "empty-world", type: "system", text: "No rooms available. Add a room to begin exploring."},
			]}
			onCommandChange={() => {}}
			onSubmit={() => {}}
		/>
	);
}

function ActiveGamePlayer({
	world,
	startingRoomId,
	teleportRequest,
	onCurrentRoomChange,
}: Omit<GamePlayerProps, "isLoading">) {
	const handledTeleportRequestRef = useRef<number | null>(null);
	const [gameState, setGameState] = useState(() => createInitialGameState(world, startingRoomId));
	const [commandList, setCommandList] = useState<string[]>([]);
	const [command, setCommand] = useState("");

	useEffect(() => {
		onCurrentRoomChange?.(gameState.player.currentRoom);
	}, [gameState.player.currentRoom, onCurrentRoomChange]);

	useEffect(() => {
		if (!teleportRequest || handledTeleportRequestRef.current === teleportRequest.id) return;

		handledTeleportRequestRef.current = teleportRequest.id;
		setGameState((currentState) => teleport(world, currentState, teleportRequest.roomId));
	}, [teleportRequest, world]);

	function submitCommand(value: string) {
		const trimmedCommand = value.trim();

		if (!trimmedCommand) return;

		setGameState((currentState) => resolveTurn(world, currentState, trimmedCommand));

		setCommandList((prevCommands) => [...prevCommands, trimmedCommand].slice(-20));
		setCommand("");
	}

	return (
		<PlayerTerminal
			command={command}
			messages={gameState.messages}
			onCommandChange={setCommand}
			onSubmit={submitCommand}
			commandHistory={commandList}
		/>
	);
}
