"use client";

import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import {world} from "../../data/worlds/exampleWorld";
import "./CommandLine.scss";

export function CommandLine() {
	const startingRoomId = world.rooms[0]?.id ?? "";

	return (
		<AdjustableBox
			height="30%"
			minHeight="120px"
			maxHeight="60%"
			className="command-line"
			adjustableEdges={["top"]}
		>
			<GamePlayer world={world} startingRoomId={startingRoomId} />
		</AdjustableBox>
	);
}
