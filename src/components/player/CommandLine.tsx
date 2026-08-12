"use client";

import {useState} from "react";
import {RefreshCw} from "lucide-react";
import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer, type GamePlayerTeleportRequest} from "./GamePlayer";
import type {World} from "../../schemas/world/worldSchema";
import {toID} from "../../utils/idUtils";
import "./CommandLine.scss";

type CommandLineProps = {
	contained?: boolean;
	isLoading?: boolean;
	world: World;
	selectedRoomId?: string | null;
};

export function CommandLine({
	contained = false,
	isLoading = false,
	world,
	selectedRoomId,
}: CommandLineProps) {
	const [teleportRequest, setTeleportRequest] = useState<GamePlayerTeleportRequest | null>(null);
	const startingRoomId = world.startRoomId;

	function syncSelectedRoom() {
		if (!selectedRoomId) return;

		setTeleportRequest((currentRequest) => ({
			id: (currentRequest?.id ?? 0) + 1,
			roomId: toID("room", selectedRoomId),
		}));
	}

	return (
		<AdjustableBox
			height={contained ? "100%" : "40%"}
			minHeight={contained ? 0 : "120px"}
			maxHeight={contained ? "100%" : "60%"}
			className="command-line"
			adjustableEdges={contained ? [] : ["top"]}
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
				isLoading={isLoading}
				world={world}
				startingRoomId={startingRoomId}
				teleportRequest={teleportRequest}
			/>
		</AdjustableBox>
	);
}
