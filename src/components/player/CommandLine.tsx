"use client";

import {useState} from "react";
import {RefreshCw} from "lucide-react";
import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import type {World} from "../../schemas/worldSchema";
import {idValue} from "../../utils/idUtils";
import "./CommandLine.scss";

type CommandLineProps = {
	world: World;
	selectedRoomId?: string | null;
};

export function CommandLine({world, selectedRoomId}: CommandLineProps) {
	const [syncVersion, setSyncVersion] = useState(0);
	const startingRoomId = selectedRoomId ?? idValue(world.startRoomId);

	function syncSelectedRoom() {
		if (!selectedRoomId) return;

		setSyncVersion((currentVersion) => currentVersion + 1);
	}

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
				key={`${startingRoomId}:${syncVersion}`}
				world={world}
				startingRoomId={startingRoomId}
			/>
		</AdjustableBox>
	);
}
