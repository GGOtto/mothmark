import {useMemo, useState} from "react";
import type {Room, RoomFeature} from "../../../schemas/worldSchema";
import {FieldLabel} from "./FieldLabel";

type RoomEditorProps = {
	selectedRoom: Room;
	rooms?: Pick<Room, "id">[];
	onRoomChange: (room: Room) => void;
};

export function RoomEditor({selectedRoom, rooms = [], onRoomChange}: RoomEditorProps) {
	const features = selectedRoom.features ?? [];
	const [expandedFeatureId, setExpandedFeatureId] = useState<string | null>(features[0]?.id ?? null);

	const duplicateRoomId = useMemo(() => {
		return rooms.filter((room) => room.id === selectedRoom.id).length > 1;
	}, [rooms, selectedRoom.id]);

	function changeRoomId(newId: string) {
		onRoomChange({
			...selectedRoom,
			id: newId,
		});
	}

	function changeRoomDescription(defaultDescription: string) {
		onRoomChange({
			...selectedRoom,
			description: {
				...selectedRoom.description,
				default: defaultDescription,
			},
		});
	}

	function changeFeature(updatedFeature: RoomFeature) {
		onRoomChange({
			...selectedRoom,
			features: features.map((feature) =>
				feature.id === updatedFeature.id ? updatedFeature : feature,
			),
		});
	}

	function changeFeatureAliases(feature: RoomFeature, aliasesText: string) {
		const aliases = aliasesText
			.split(",")
			.map((alias) => alias.trim())
			.filter(Boolean);

		changeFeature({
			...feature,
			aliases,
		});
	}

	function changeFeatureDescription(feature: RoomFeature, defaultDescription: string) {
		changeFeature({
			...feature,
			description: {
				...feature.description,
				default: defaultDescription,
			},
		});
	}

	return (
		<div className="rightSideBarSection roomEditor">
			<div className="roomEditorHeader">
				<p className="roomEditorEyebrow">Selected Room</p>
				<h2 className="roomEditorTitle">{selectedRoom.name || "Unnamed Room"}</h2>
			</div>

			<div className="rightSideBarFieldGroup">
				<FieldLabel htmlFor="room-name">Room Name</FieldLabel>
				<input
					id="room-name"
					className="rightSideBarInput"
					value={selectedRoom.name}
					onChange={(event) =>
						onRoomChange({
							...selectedRoom,
							name: event.target.value,
						})
					}
				/>
			</div>

			<div className="rightSideBarFieldGroup">
				<FieldLabel htmlFor="room-id">Room ID</FieldLabel>
				<input
					id="room-id"
					className={`rightSideBarInput ${duplicateRoomId ? "rightSideBarInputError" : ""}`}
					value={selectedRoom.id}
					onChange={(event) => changeRoomId(event.target.value)}
				/>

				{duplicateRoomId ? (
					<p className="rightSideBarWarningText">This room ID is already being used.</p>
				) : (
					<p className="rightSideBarHelpText">Used by exits, commands, and world data.</p>
				)}
			</div>

			<div className="rightSideBarFieldGroup">
				<FieldLabel htmlFor="room-description">Description</FieldLabel>
				<textarea
					id="room-description"
					className="rightSideBarTextarea"
					value={selectedRoom.description.default}
					rows={7}
					onChange={(event) => changeRoomDescription(event.target.value)}
				/>
			</div>

			<section className="roomEditorFeaturePanel" aria-labelledby="room-features-title">
				<div className="roomEditorFeaturePanelHeader">
					<h3 id="room-features-title" className="roomEditorSectionTitle">
						Features
					</h3>

					<span className="roomEditorFeatureCount">{features.length}</span>
				</div>

				{features.length > 0 ? (
					<div className="roomEditorFeatureList">
						{features.map((feature) => {
							const expanded = expandedFeatureId === feature.id;

							return (
								<article
									key={feature.id}
									className={`roomEditorFeatureCard ${expanded ? "roomEditorFeatureCardExpanded" : ""}`}
								>
									<button
										type="button"
										className="roomEditorFeatureButton"
										onClick={() => setExpandedFeatureId(expanded ? null : feature.id)}
									>
										<span>
											<strong>{feature.name || "Unnamed Feature"}</strong>
											<small>{feature.id}</small>
										</span>

										<span className="roomEditorFeatureToggle">{expanded ? "Collapse" : "Edit"}</span>
									</button>

									{expanded ? (
										<div className="roomEditorFeatureBody">
											<div className="rightSideBarFieldGroup">
												<FieldLabel htmlFor={`feature-${feature.id}-name`}>Feature Name</FieldLabel>
												<input
													id={`feature-${feature.id}-name`}
													className="rightSideBarInput"
													value={feature.name}
													onChange={(event) =>
														changeFeature({
															...feature,
															name: event.target.value,
														})
													}
												/>
											</div>

											<div className="rightSideBarFieldGroup">
												<FieldLabel htmlFor={`feature-${feature.id}-id`}>Feature ID</FieldLabel>
												<input
													id={`feature-${feature.id}-id`}
													className="rightSideBarInput"
													value={feature.id}
													onChange={(event) =>
														changeFeature({
															...feature,
															id: event.target.value,
														})
													}
												/>
											</div>

											<div className="rightSideBarFieldGroup">
												<FieldLabel htmlFor={`feature-${feature.id}-description`}>Description</FieldLabel>
												<textarea
													id={`feature-${feature.id}-description`}
													className="rightSideBarTextarea roomEditorFeatureTextarea"
													value={feature.description.default}
													rows={4}
													onChange={(event) => changeFeatureDescription(feature, event.target.value)}
												/>
											</div>

											<div className="rightSideBarFieldGroup">
												<FieldLabel htmlFor={`feature-${feature.id}-aliases`}>Aliases</FieldLabel>
												<input
													id={`feature-${feature.id}-aliases`}
													className="rightSideBarInput"
													value={feature.aliases.join(", ")}
													placeholder="desk, table, old desk"
													onChange={(event) => changeFeatureAliases(feature, event.target.value)}
												/>
												<p className="rightSideBarHelpText">Separate aliases with commas.</p>
											</div>

											<label className="rightSideBarCheckboxRow">
												<input
													type="checkbox"
													checked={feature.listedInRoom}
													onChange={(event) =>
														changeFeature({
															...feature,
															listedInRoom: event.target.checked,
														})
													}
												/>
												<span>Listed in room</span>
											</label>

											<div className="rightSideBarFieldGroup">
												<FieldLabel htmlFor={`feature-${feature.id}-active`}>Active When</FieldLabel>
												<input
													id={`feature-${feature.id}-active`}
													className="rightSideBarInput rightSideBarInputMuted"
													value={
														feature.activeWhen.length > 0 ? JSON.stringify(feature.activeWhen) : "Always active"
													}
													disabled
													readOnly
												/>
											</div>
										</div>
									) : null}
								</article>
							);
						})}
					</div>
				) : (
					<p className="roomEditorEmptyFeatures">
						No features yet. Add room features from the world data or feature tools when those are wired
						up.
					</p>
				)}
			</section>

			{/* TODO: Replace the disabled Active When display with a real condition editor. */}
		</div>
	);
}
