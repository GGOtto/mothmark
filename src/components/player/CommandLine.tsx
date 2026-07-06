"use client";

import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import type {World} from "../../schemas/worldSchema";
import "./CommandLine.scss";

type CommandLineProps = {
	world: World;
};

export function CommandLine({world}: CommandLineProps) {
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
