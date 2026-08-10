"use client";

import {produce} from "immer";
import {RotateCcw} from "lucide-react";
import {useCallback, useMemo, useState} from "react";

import {createInitialWorld} from "@/data/worlds/initialWorld";
import {Map, type ConnectionDraft} from "@/components/map/Map";
import {GamePlayer} from "@/components/player/GamePlayer";
import {idValue, type ID} from "@/utils/idUtils";

const HOME_ROOM_POSITIONS = {
	"shop-floor": {x: 210, y: 160},
	stockroom: {x: 420, y: 160},
	office: {x: 210, y: 30},
	cellar: {x: 210, y: 290},
};

export function createHomeExampleWorld() {
	return produce(createInitialWorld(), (draft) => {
		for (const room of draft.rooms) {
			const position = HOME_ROOM_POSITIONS[idValue(room.id) as keyof typeof HOME_ROOM_POSITIONS];
			if (position) room.metadata.position = position;
		}
		draft.metadata.layers = [
			{
				name: "Example world",
				layer: 0,
				rooms: draft.rooms.map((room) => room.id),
				viewport: {x: -60, y: 8, zoom: 1},
			},
		];
	});
}

export function HomeExample() {
	const world = useMemo(() => createHomeExampleWorld(), []);
	const [selectedId, setSelectedId] = useState<string | null>(idValue(world.startRoomId));
	const [isConnectionSelected, setIsConnectionSelected] = useState(false);
	const [connectionDraft, setConnectionDraft] = useState<ConnectionDraft>({state: "idle"});
	const [playerKey, setPlayerKey] = useState(0);
	const updateCurrentRoom = useCallback((roomId: ID<"room">) => {
		setSelectedId(idValue(roomId));
		setIsConnectionSelected(false);
	}, []);

	return (
		<section className="homeExample" aria-label="Interactive Corner Shop example">
			<header className="homeExampleHeader">
				<div>
					<strong>Corner Shop</strong>
					<span>Example world</span>
				</div>
				<span>Pan or zoom the map · Try a command</span>
			</header>

			<div className="homeExampleBody">
				<div className="homeExampleMap">
					<Map
						world={world}
						readOnly
						ariaLabel="Pan and zoom map of the Corner Shop example world"
						tool="pan"
						onToolChange={() => {}}
						updateWorld={() => {}}
						selectedId={selectedId}
						setSelectedId={setSelectedId}
						isConnectionSelected={isConnectionSelected}
						setIsConnectionSelected={setIsConnectionSelected}
						connectionDraft={connectionDraft}
						setConnectionDraft={setConnectionDraft}
						updateStatus={() => {}}
						recenterRequest={0}
					/>
					<span>Map · pan and zoom</span>
				</div>

				<div className="homeExamplePlayer">
					<div className="homeExamplePlayerHeader">
						<strong>Play</strong>
						<button type="button" onClick={() => setPlayerKey((current) => current + 1)}>
							<RotateCcw size={14} aria-hidden="true" />
							Restart
						</button>
					</div>
					<GamePlayer
						key={playerKey}
						world={world}
						startingRoomId={world.startRoomId}
						onCurrentRoomChange={updateCurrentRoom}
					/>
				</div>
			</div>
		</section>
	);
}
