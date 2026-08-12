import {AdjustableBox} from "../ui/AdjustableBox";
import {GamePlayer} from "./GamePlayer";
import type {World} from "../../schemas/world/worldSchema";
import "./CommandLine.scss";

type CommandLineProps = {
	contained?: boolean;
	isLoading?: boolean;
	world: World;
};

export function CommandLine({contained = false, isLoading = false, world}: CommandLineProps) {
	const startingRoomId = world.startRoomId;

	return (
		<AdjustableBox
			height={contained ? "100%" : "40%"}
			minHeight={contained ? 0 : "120px"}
			maxHeight={contained ? "100%" : "60%"}
			className="command-line"
			adjustableEdges={contained ? [] : ["top"]}
		>
			<GamePlayer isLoading={isLoading} world={world} startingRoomId={startingRoomId} />
		</AdjustableBox>
	);
}
