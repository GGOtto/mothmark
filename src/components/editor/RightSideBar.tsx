import type {Room, Connection, Pathway} from "../../schemas/worldSchema";

type RightSideBarProps = {
	selectedRoom: Room | null;
	selectedConnection: Connection | null;
	onRoomChange: (room: Room) => void;
	onConnectionChange: (connection: Connection) => void;
};

const PATHWAY_OPTIONS: Pathway[] = ["two-way", "forwards", "backwards", "no-way"];

type FieldLabelProps = {
	children: React.ReactNode;
};

function FieldLabel({children}: FieldLabelProps) {
	return (
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
			{children}
		</label>
	);
}

const inputStyle: React.CSSProperties = {
	width: "100%",
	boxSizing: "border-box",
	padding: "8px",
	border: "1px solid #2f2920",
	background: "#f4ecd8",
	color: "#2f2920",
};

export function RightSideBar({
	selectedRoom,
	selectedConnection,
	onRoomChange,
	onConnectionChange,
}: RightSideBarProps) {
	return (
		<aside
			style={{
				width: "33%",
				height: "100%",
				borderLeft: "1px solid #ddd",
				padding: "16px",
				boxSizing: "border-box",
			}}
		>
			{selectedRoom ? (
				<RoomEditor selectedRoom={selectedRoom} onRoomChange={onRoomChange} />
			) : selectedConnection ? (
				<ConnectionEditor
					selectedConnection={selectedConnection}
					onConnectionChange={onConnectionChange}
				/>
			) : (
				<p style={{margin: 0, color: "#777"}}>Select a room or connection</p>
			)}
		</aside>
	);
}

type RoomEditorProps = {
	selectedRoom: Room;
	onRoomChange: (room: Room) => void;
};

function RoomEditor({selectedRoom, onRoomChange}: RoomEditorProps) {
	return (
		<div>
			<FieldLabel>Room Name</FieldLabel>

			<input
				value={selectedRoom.name}
				onChange={(event) =>
					onRoomChange({
						...selectedRoom,
						name: event.target.value,
					})
				}
				style={inputStyle}
			/>
		</div>
	);
}

type ConnectionEditorProps = {
	selectedConnection: Connection;
	onConnectionChange: (connection: Connection) => void;
};

function ConnectionEditor({selectedConnection, onConnectionChange}: ConnectionEditorProps) {
	return (
		<div>
			<FieldLabel>Connection</FieldLabel>

			<div style={{marginBottom: "16px", color: "#777", fontSize: "13px"}}>
				<div>
					<strong>From:</strong> {selectedConnection.fromRoomId} {selectedConnection.direction}
				</div>
				<div>
					<strong>To:</strong> {selectedConnection.toRoomId} {selectedConnection.returnDirection}
				</div>
			</div>

			<FieldLabel>Pathway</FieldLabel>

			<select
				value={selectedConnection.pathway}
				onChange={(event) =>
					onConnectionChange({
						...selectedConnection,
						pathway: event.target.value as Pathway,
					})
				}
				style={inputStyle}
			>
				{PATHWAY_OPTIONS.map((pathway) => (
					<option key={pathway} value={pathway}>
						{pathway}
					</option>
				))}
			</select>
		</div>
	);
}
