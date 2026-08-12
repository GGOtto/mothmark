"use client";

import {RotateCcw} from "lucide-react";
import {produce} from "immer";
import {useEffect, useRef, useState} from "react";
import type {World} from "../../schemas/world/worldSchema";
import {createInitialGameState} from "../../engine/states/createInitialState";
import {createItemState, createRoomState} from "../../engine/states/createEntityState";
import {resolveTurn} from "../../engine/player/resolveTurn";
import {teleport} from "../../engine/player/teleport";
import {PlayerTerminal} from "./PlayerTerminal";
import {compareIds, type ID} from "../../utils/idUtils";
import "./GamePlayer.scss";

type GamePlayerProps = {
	isLoading?: boolean;
	world: World;
	startingRoomId: ID<"room">;
	teleportRequest?: GamePlayerTeleportRequest | null;
	onCurrentRoomChange?: (roomId: ID<"room">) => void;
	isHeaderHidden?: boolean;
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
	isHeaderHidden,
}: GamePlayerProps) {
	const resolvedStartingRoomId = world.rooms.some((room) => compareIds(room.id, startingRoomId))
		? startingRoomId
		: world.rooms[0]
			? world.rooms[0].id
			: null;

	return isLoading ? (
		<LoadingGamePlayer isHeaderHidden={isHeaderHidden} />
	) : resolvedStartingRoomId ? (
		<ActiveGamePlayer
			world={world}
			startingRoomId={resolvedStartingRoomId}
			teleportRequest={teleportRequest}
			onCurrentRoomChange={onCurrentRoomChange}
			isHeaderHidden={isHeaderHidden}
		/>
	) : (
		<EmptyGamePlayer isHeaderHidden={isHeaderHidden} />
	);
}

function LoadingGamePlayer({isHeaderHidden}: {isHeaderHidden?: boolean}) {
	return (
		<PlayerFrame restartDisabled isHeaderHidden={isHeaderHidden}>
			<PlayerTerminal
				disabled
				command=""
				messages={[]}
				onCommandChange={() => {}}
				onSubmit={() => {}}
			/>
		</PlayerFrame>
	);
}

function EmptyGamePlayer({isHeaderHidden}: {isHeaderHidden?: boolean}) {
	return (
		<PlayerFrame restartDisabled isHeaderHidden>
			<PlayerTerminal
				disabled
				command=""
				messages={[
					{
						id: "empty-world",
						type: "system",
						text: "No rooms available. Add a room to begin exploring.",
					},
				]}
				onCommandChange={() => {}}
				onSubmit={() => {}}
			/>
		</PlayerFrame>
	);
}

function PlayerFrame({
	children,
	onRestart,
	restartDisabled = false,
	isHeaderHidden = false,
}: {
	children: React.ReactNode;
	onRestart?: () => void;
	restartDisabled?: boolean;
	isHeaderHidden?: boolean;
}) {
	return (
		<div className="game-player-frame">
			{!isHeaderHidden && (
				<div className="game-player__toolbar" aria-label="Player controls">
					<span>Live preview</span>
					<button type="button" onClick={onRestart} disabled={restartDisabled}>
						<RotateCcw size={13} aria-hidden="true" />
						Restart
					</button>
				</div>
			)}
			{children}
		</div>
	);
}

function ActiveGamePlayer({
	world,
	startingRoomId,
	teleportRequest,
	onCurrentRoomChange,
	isHeaderHidden,
}: Omit<GamePlayerProps, "isLoading">) {
	const handledTeleportRequestRef = useRef<number | null>(null);
	const previousWorldRef = useRef(world);
	const [gameState, setGameState] = useState(() => createInitialGameState(world, startingRoomId));
	const [commandList, setCommandList] = useState<string[]>([]);
	const [command, setCommand] = useState("");
	const currentRoomAvailable = world.rooms.some((room) =>
		compareIds(room.id, gameState.player.currentRoom),
	);

	useEffect(() => {
		onCurrentRoomChange?.(gameState.player.currentRoom);
	}, [gameState.player.currentRoom, onCurrentRoomChange]);

	useEffect(() => {
		const previousWorld = previousWorldRef.current;
		previousWorldRef.current = world;
		if (previousWorld === world) return;

		setGameState((currentState) =>
			produce(currentState, (draft) => {
				draft.roomStates = draft.roomStates.filter((roomState) =>
					world.rooms.some((room) => compareIds(room.id, roomState.id)),
				);
				for (const room of world.rooms) {
					const roomState = draft.roomStates.find((state) => compareIds(state.id, room.id));
					const previousRoom = previousWorld.rooms.find((candidate) =>
						compareIds(candidate.id, room.id),
					);
					if (!roomState) {
						draft.roomStates.push(createRoomState(room));
						continue;
					}
					if (!previousRoom || previousRoom.name !== room.name) roomState.name = room.name;
					if (!previousRoom || previousRoom.description !== room.description)
						roomState.description = room.description;
					if (!previousRoom || previousRoom.shortDescription !== room.shortDescription)
						roomState.shortDescription = room.shortDescription;
					if (!previousRoom || JSON.stringify(previousRoom.aliases) !== JSON.stringify(room.aliases))
						roomState.aliases = room.aliases;
					if (!previousRoom || JSON.stringify(previousRoom.tags) !== JSON.stringify(room.tags))
						roomState.tags = room.tags;
				}

				draft.itemStates = draft.itemStates.filter((itemState) =>
					world.items.some((item) => compareIds(item.id, itemState.id)),
				);
				for (const item of world.items) {
					const itemState = draft.itemStates.find((state) => compareIds(state.id, item.id));
					const previousItem = previousWorld.items.find((candidate) =>
						compareIds(candidate.id, item.id),
					);
					if (!itemState) {
						draft.itemStates.push(createItemState(item));
						continue;
					}
					if (!previousItem || previousItem.name !== item.name) itemState.name = item.name;
					if (!previousItem || previousItem.examine.text !== item.examine.text)
						itemState.description = item.examine.text;
					if (!previousItem || previousItem.presentation.listedInRoom !== item.presentation.listedInRoom)
						itemState.listedInRoom = item.presentation.listedInRoom;
					if (!previousItem || previousItem.presentation.listingText !== item.presentation.listingText)
						itemState.listingText = item.presentation.listingText;
					if (!previousItem || JSON.stringify(previousItem.aliases) !== JSON.stringify(item.aliases))
						itemState.aliases = item.aliases;
					if (!previousItem || JSON.stringify(previousItem.tags) !== JSON.stringify(item.tags))
						itemState.tags = item.tags;
					if (!previousItem || JSON.stringify(previousItem.behaviors) !== JSON.stringify(item.behaviors))
						itemState.behaviorTags = item.behaviors.map((behavior) => behavior.type);
				}
			}),
		);
	}, [world]);

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

	function restart() {
		handledTeleportRequestRef.current = null;
		setGameState(createInitialGameState(world, startingRoomId));
		setCommandList([]);
		setCommand("");
	}

	const messages = currentRoomAvailable
		? gameState.messages
		: [
				...gameState.messages,
				{
					id: "editor-world-changed",
					type: "system" as const,
					text: "The current room was removed from the world. Restart the preview to continue.",
				},
			];

	return (
		<PlayerFrame onRestart={restart} isHeaderHidden={isHeaderHidden}>
			<PlayerTerminal
				disabled={!currentRoomAvailable}
				command={command}
				messages={messages}
				onCommandChange={setCommand}
				onSubmit={submitCommand}
				commandHistory={commandList}
			/>
		</PlayerFrame>
	);
}
