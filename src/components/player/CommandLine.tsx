"use client";

import {useEffect, useState} from "react";
import {RefreshCw} from "lucide-react";
import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import type {World} from "../../schemas/worldSchema";
import "./CommandLine.scss";

type CommandLineProps = {
	world: World;
	selectedRoomId?: string | null;
};

export function CommandLine({world, selectedRoomId}: CommandLineProps) {
	const startingRoomId = world.rooms[0]?.id ?? "";
	const [syncedRoomId, setSyncedRoomId] = useState<string | null>(null);
	const [syncVersion, setSyncVersion] = useState(0);

	function syncSelectedRoom() {
		if (!selectedRoomId) return;

		setSyncedRoomId(selectedRoomId);
		setSyncVersion((currentVersion) => currentVersion + 1);
	}

	useEffect(() => {
		if (!selectedRoomId) return;

		syncSelectedRoom();
	}, [selectedRoomId]);

	return (
		<AdjustableBox
			height="40%"
			minHeight="120px"
			maxHeight="60%"
			className="command-line"
			adjustableEdges={["top"]}
		>
			<div className="command-line__toolbar">
				<button
					type="button"
					className="command-line__sync-button"
					onClick={syncSelectedRoom}
					disabled={!selectedRoomId}
				>
					<RefreshCw size={14} aria-hidden="true" />
					<span>Sync Room</span>
				</button>
			</div>

			<GamePlayer
				world={world}
				startingRoomId={startingRoomId}
				syncedRoomId={syncedRoomId}
				syncVersion={syncVersion}
			/>
		</AdjustableBox>
	);
}
