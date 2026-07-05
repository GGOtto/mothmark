import {GamePlayer} from "../../components/player/GamePlayer";
import {world} from "../../data/worlds/exampleWorld";

export default function PlayPage() {
	const startingRoomId = world.rooms[0]?.id ?? ""; // TODO: add starting room to world data

	return <GamePlayer world={world} startingRoomId={startingRoomId} />;
}
