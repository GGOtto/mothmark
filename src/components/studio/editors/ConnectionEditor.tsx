import {useMemo} from "react";
import {produce} from "immer";
import {ArrowLeft, ArrowLeftRight, ArrowRight, X} from "lucide-react";
import {type World} from "../../../schemas/world/worldSchema";
import {ConnectionSchema, type Connection, type Pathway} from "../../../schemas/world/roomSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {replaceConnectionDraft} from "@/app/editor/utils/worldDraftUtils";
import {resolveEditorMetadata} from "@/components/universal-editor/utils/resolveEditorMetadata";
import {renderEditorControl} from "@/components/universal-editor/renderEditorControl";
import type {EditorControlContext} from "@/types/universalEditorTypes";
import {
	compareIds,
	deleteWorldEntity,
	idValue,
	resolveWorldEntityName,
	toID,
	updateWorldEntityId,
} from "@/utils/idUtils";
import {useOptionalPopup} from "@/components/popup/Popup";
import {findEntityReferenceUsages} from "@/components/logic/shared/editorRelationships";
import "./ConnectionEditor.scss";

type PathwayIndicatorProps = {
	pathway: Pathway;
};

export function PathwayIndicator({pathway}: PathwayIndicatorProps) {
	switch (pathway) {
		case "forwards":
			return <ArrowRight className="connectionEditorPathwayIcon" aria-label="Forwards connection" />;

		case "backwards":
			return <ArrowLeft className="connectionEditorPathwayIcon" aria-label="Backwards connection" />;

		case "two-way":
			return (
				<ArrowLeftRight className="connectionEditorPathwayIcon" aria-label="Two-way connection" />
			);

		case "no-way":
			return <X className="connectionEditorPathwayIcon" aria-label="No-way connection" />;

		default:
			return null;
	}
}

type ConnectionEditorProps = {
	selectedConnection: Connection;
	connections?: Pick<Connection, "id">[];
	world?: World;
	updateWorld?: UpdateWorld;
	onSelectedIdChange?: (selectedId: string) => void;
	onDelete?: () => void;
};

export function ConnectionEditor({
	selectedConnection,
	connections = [],
	world,
	updateWorld,
	onSelectedIdChange,
	onDelete,
}: ConnectionEditorProps) {
	const popup = useOptionalPopup();
	const duplicateConnectionId = useMemo(() => {
		return (
			connections.filter((connection) => compareIds(connection.id, selectedConnection.id)).length > 1
		);
	}, [connections, selectedConnection.id]);
	const connectionTitle =
		selectedConnection.name && selectedConnection.name !== "" ? selectedConnection.name : null;
	const fromRoomLabel =
		(world
			? resolveWorldEntityName(world, toID("room", selectedConnection.fromRoomId))
			: undefined) ?? idValue(selectedConnection.fromRoomId);
	const toRoomLabel =
		(world ? resolveWorldEntityName(world, toID("room", selectedConnection.toRoomId)) : undefined) ??
		idValue(selectedConnection.toRoomId);
	const nameMetadata = resolveEditorMetadata(ConnectionSchema.shape.name);
	const fromRoomMetadata = resolveEditorMetadata(ConnectionSchema.shape.fromRoomId);
	const toRoomMetadata = resolveEditorMetadata(ConnectionSchema.shape.toRoomId);
	const directionMetadata = {
		...resolveEditorMetadata(ConnectionSchema.shape.direction),
		title: "Start direction",
	};
	const returnDirectionMetadata = {
		...resolveEditorMetadata(ConnectionSchema.shape.returnDirection),
		title: "Return direction",
	};
	const pathwayMetadata = resolveEditorMetadata(ConnectionSchema.shape.pathway);
	const idMetadata = resolveEditorMetadata(ConnectionSchema.shape.id);
	const directionEditorContext: EditorControlContext = {
		mode: "edit",
		getValue: () => undefined,
		setValue: () => undefined,
		appearance: {theme: "mothmark", scheme: "auto"},
	};

	function handleConnectionChange(updatedConnection: Connection) {
		const selectedConnectionId = idValue(selectedConnection.id);
		const updatedConnectionId = idValue(updatedConnection.id);

		if (world && updatedConnectionId !== selectedConnectionId) {
			const worldWithConnectionChanges = produce(world, (draft) => {
				replaceConnectionDraft(draft, selectedConnection.id, {
					...updatedConnection,
					id: selectedConnection.id,
				});
			});
			const renamedWorld = updateWorldEntityId(
				worldWithConnectionChanges,
				toID("connection", selectedConnection.id),
				updatedConnection.id,
			);

			updateWorld?.(renamedWorld);
			if (renamedWorld !== worldWithConnectionChanges) onSelectedIdChange?.(updatedConnectionId);
			return;
		}

		updateWorld?.((world) => {
			replaceConnectionDraft(world, selectedConnection.id, updatedConnection);
		});
	}

	async function deleteConnection() {
		if (!world || !updateWorld) return;
		const usages = findEntityReferenceUsages(world, selectedConnection.id);
		const confirmed = popup
			? await popup.confirm({
					title: `Delete ${connectionTitle || "this connection"}?`,
					message: (
						<div>
							<p>This removes the route and repairs or removes records that depend on it.</p>
							{usages.length ? (
								<ul>
									{usages.map((usage) => (
										<li key={usage.key}>
											{usage.label} · {usage.detail}
										</li>
									))}
								</ul>
							) : null}
						</div>
					),
					confirmLabel: "Delete connection",
					danger: true,
				})
			: globalThis.confirm(`Delete ${connectionTitle || "this connection"}?`);
		if (!confirmed) return;
		const nextWorld = deleteWorldEntity(world, selectedConnection.id);
		if (nextWorld === world) return;
		updateWorld(nextWorld);
		onDelete?.();
	}

	return (
		<div className="rightSideBarSection connectionEditor">
			<div className="roomEditorHeader roomEditorHeader--withAction">
				<div>
					<p className="roomEditorEyebrow">Selected connection</p>
					<h2 className="roomEditorTitle">
						{connectionTitle ?? (
							<span className="connectionEditorPathwayTitle">
								<span>{fromRoomLabel}</span>
								<PathwayIndicator pathway={selectedConnection.pathway} />
								<span>{toRoomLabel}</span>
							</span>
						)}
					</h2>
				</div>
				{world && updateWorld ? (
					<button type="button" className="roomEditorDelete" onClick={() => void deleteConnection()}>
						Delete connection
					</button>
				) : null}
			</div>

			{duplicateConnectionId ? (
				<p className="rightSideBarWarningText">
					This connection is already using the same internal identifier.
				</p>
			) : null}

			<div className="connectionEditorForm">
				<section aria-labelledby="connection-identity-heading">
					<h3 id="connection-identity-heading">Identity</h3>
					<label>
						<span>{nameMetadata.title}</span>
						<input
							type="text"
							value={selectedConnection.name ?? ""}
							onChange={(event) =>
								handleConnectionChange({...selectedConnection, name: event.target.value || undefined})
							}
						/>
						{nameMetadata.description ? <small>{nameMetadata.description}</small> : null}
					</label>
				</section>

				<section aria-labelledby="connection-route-heading">
					<h3 id="connection-route-heading">Route</h3>
					<div className="connectionEditorForm__pair">
						<label>
							<span>{fromRoomMetadata.title}</span>
							<select
								value={idValue(selectedConnection.fromRoomId)}
								onChange={(event) =>
									handleConnectionChange({
										...selectedConnection,
										fromRoomId: toID("room", event.target.value),
									})
								}
							>
								{world?.rooms.map((room) => (
									<option key={idValue(room.id)} value={idValue(room.id)}>
										{room.name || idValue(room.id)}
									</option>
								))}
							</select>
						</label>
						<label>
							<span>{toRoomMetadata.title}</span>
							<select
								value={idValue(selectedConnection.toRoomId)}
								onChange={(event) =>
									handleConnectionChange({
										...selectedConnection,
										toRoomId: toID("room", event.target.value),
									})
								}
							>
								{world?.rooms.map((room) => (
									<option key={idValue(room.id)} value={idValue(room.id)}>
										{room.name || idValue(room.id)}
									</option>
								))}
							</select>
						</label>
					</div>
					<div className="connectionEditorForm__pair">
						{renderEditorControl({
							value: selectedConnection.direction,
							onChange: (nextDirection) =>
								handleConnectionChange({
									...selectedConnection,
									direction: nextDirection as Connection["direction"],
								}),
							metadata: directionMetadata,
							path: ["connections", idValue(selectedConnection.id), "direction"],
							context: directionEditorContext,
						})}
						{renderEditorControl({
							value: selectedConnection.returnDirection,
							onChange: (nextDirection) =>
								handleConnectionChange({
									...selectedConnection,
									returnDirection: nextDirection as Connection["returnDirection"],
								}),
							metadata: returnDirectionMetadata,
							path: ["connections", idValue(selectedConnection.id), "returnDirection"],
							context: directionEditorContext,
						})}
					</div>
				</section>

				<section aria-labelledby="connection-travel-heading">
					<h3 id="connection-travel-heading">Travel behavior</h3>
					<label>
						<span>{pathwayMetadata.title}</span>
						<select
							value={selectedConnection.pathway}
							onChange={(event) =>
								handleConnectionChange({
									...selectedConnection,
									pathway: event.target.value as Pathway,
								})
							}
						>
							{pathwayMetadata.options?.map((option) => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
						{pathwayMetadata.description ? <small>{pathwayMetadata.description}</small> : null}
					</label>
				</section>

				<details className="connectionEditorForm__advanced">
					<summary>Advanced</summary>
					<label>
						<span>{idMetadata.title}</span>
						<input
							type="text"
							value={idValue(selectedConnection.id)}
							onChange={(event) =>
								handleConnectionChange({
									...selectedConnection,
									id: toID("connection", event.target.value),
								})
							}
						/>
						{idMetadata.description ? <small>{idMetadata.description}</small> : null}
					</label>
				</details>
			</div>
		</div>
	);
}
