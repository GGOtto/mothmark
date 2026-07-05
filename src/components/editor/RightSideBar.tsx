import type {Room} from "../../schemas/worldSchema";

type RightSideBarProps = {
	selectedRoom: Room | null;
	onRoomChange: (room: Room) => void;
};

export function RightSideBar({selectedRoom, onRoomChange}: RightSideBarProps) {
	return (
		<aside
			style={{
				width: "20%",
				height: "100%",
				borderLeft: "1px solid #ddd",
				padding: "16px",
				boxSizing: "border-box",
			}}
		>
			{selectedRoom ? (
				<div>
					<label
						style={{
							display: "block",
							marginBottom: "8px",
							fontSize: "12px",
							fontWeight: 700,
							textTransform: "uppercase",
							letterSpacing: "0.08em",
						}}
					>
						Room Name
					</label>

					<input
						value={selectedRoom.name}
						onChange={(event) =>
							onRoomChange({
								...selectedRoom,
								name: event.target.value,
							})
						}
						style={{
							width: "100%",
							boxSizing: "border-box",
							padding: "8px",
							border: "1px solid #2f2920",
							background: "#f4ecd8",
							color: "#2f2920",
						}}
					/>
				</div>
			) : (
				<p style={{margin: 0, color: "#777"}}>Select a room</p>
			)}
		</aside>
	);
}
