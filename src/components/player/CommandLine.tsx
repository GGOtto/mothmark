"use client";

import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import {world} from "../../data/worlds/exampleWorld";

export function CommandLine() {
	const startingRoomId = world.rooms[0]?.id ?? ""; // TODO: add starting room to world data

	return (
		<AdjustableBox
			height="30%"
			minHeight="120px"
			className="w-full shrink-0 border border-[#ddd]"
			adjustableEdges={["top"]}
		>
			<GamePlayer world={world} startingRoomId={startingRoomId} />
		</AdjustableBox>
	);
}
