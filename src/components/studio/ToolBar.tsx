"use client";

import {
	CircleX,
	CornerDownLeft,
	Focus,
	Hand,
	Map,
	MousePointer2,
	MousePointerClick,
} from "lucide-react";
import type {MapTool} from "../map/Map";
import "./ToolBar.scss";

type ToolBarProps = {
	activeTool: MapTool;
	onToolChange: (tool: MapTool) => void;
	zoom: number;
	onRecenter: () => void;
	status: ToolBarStatus;
};

export type ToolBarStatus = {
	kind: "cancelled" | "destination" | "idle" | "return";
	label: string;
};

export function ToolBar({activeTool, onToolChange, zoom, onRecenter, status}: ToolBarProps) {
	const StatusIcon = {
		cancelled: CircleX,
		destination: MousePointerClick,
		idle: Map,
		return: CornerDownLeft,
	}[status.kind];

	return (
		<div className="toolbar" aria-label="Map tools">
			<div className="toolbarTools" role="group" aria-label="Pointer tool">
				<button
					type="button"
					className={`toolbarTool ${activeTool === "edit" ? "toolbarToolActive" : ""}`}
					onClick={() => onToolChange("edit")}
					aria-pressed={activeTool === "edit"}
					title="Edit map (V)"
				>
					<MousePointer2 size={17} strokeWidth={1.9} />
					<span>Edit</span>
				</button>
				<button
					type="button"
					className={`toolbarTool ${activeTool === "pan" ? "toolbarToolActive" : ""}`}
					onClick={() => onToolChange("pan")}
					aria-pressed={activeTool === "pan"}
					title="Pan map (H)"
				>
					<Hand size={17} strokeWidth={1.9} />
					<span>Pan</span>
				</button>
				<button type="button" className="toolbarTool" onClick={onRecenter} title="Recenter map">
					<Focus size={17} strokeWidth={1.9} />
					<span>Recenter</span>
				</button>
			</div>
			<div className="toolbarDivider" aria-hidden="true" />
			<div className="toolbarZoom" aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>
				{Math.round(zoom * 100)}%
			</div>
			<div className="toolbarHint">Scroll to zoom</div>
			<div className="toolbarStatus" aria-label={status.label}>
				<StatusIcon size={14} strokeWidth={2} aria-hidden="true" />
				<span>{status.label}</span>
			</div>
		</div>
	);
}
