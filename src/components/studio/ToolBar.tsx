"use client";

import {CircleX, CornerDownLeft, Focus, Map, MousePointerClick, Plus, X} from "lucide-react";
import {useCallback, useEffect, useRef, useState} from "react";
import "./ToolBar.scss";

type ToolBarProps = {
	isAddingRoom: boolean;
	onAddingRoomChange: (isAddingRoom: boolean) => void;
	addRoomDisabled?: boolean;
	zoom: number;
	onRecenter: () => void;
	status: ToolBarStatus;
};

export type ToolBarStatus = {
	kind: "cancelled" | "destination" | "idle" | "node" | "pathway" | "placement" | "return";
	label: string;
};

export type StatusChannel = "hover" | "notice";

export type UpdateStatus = (
	status: ToolBarStatus | null,
	options?: {channel?: StatusChannel; duration?: number},
) => void;

const DEFAULT_NOTICE_DURATION = 1800;

export function useToolBarStatus() {
	const [hoverStatus, setHoverStatus] = useState<ToolBarStatus | null>(null);
	const [noticeStatus, setNoticeStatus] = useState<ToolBarStatus | null>(null);
	const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearNoticeTimers = useCallback(() => {
		if (clearTimer.current) clearTimeout(clearTimer.current);
		clearTimer.current = null;
	}, []);

	useEffect(() => clearNoticeTimers, [clearNoticeTimers]);

	const updateStatus = useCallback<UpdateStatus>(
		(status, options) => {
			if (options?.channel !== "notice") {
				setHoverStatus(status);
				return;
			}

			clearNoticeTimers();
			setNoticeStatus(status);

			if (!status) return;

			const duration = options.duration ?? DEFAULT_NOTICE_DURATION;
			clearTimer.current = setTimeout(() => setNoticeStatus(null), duration);
		},
		[clearNoticeTimers],
	);

	return {hoverStatus, noticeStatus, updateStatus};
}

export function ToolBar({
	isAddingRoom,
	onAddingRoomChange,
	addRoomDisabled = false,
	zoom,
	onRecenter,
	status,
}: ToolBarProps) {
	const StatusIcon = {
		cancelled: CircleX,
		destination: MousePointerClick,
		idle: Map,
		node: MousePointerClick,
		pathway: MousePointerClick,
		placement: Plus,
		return: CornerDownLeft,
	}[status.kind];

	return (
		<div className="toolbar" aria-label="Map tools">
			<div className="toolbarTools" role="group" aria-label="Map actions">
				<button
					type="button"
					className={`toolbarTool toolbarAddRoom ${isAddingRoom ? "toolbarToolActive" : ""}`}
					onClick={() => onAddingRoomChange(!isAddingRoom)}
					aria-pressed={isAddingRoom}
					aria-label={isAddingRoom ? "Cancel room placement" : "Add room"}
					title={isAddingRoom ? "Cancel room placement (Escape)" : "Add room"}
					disabled={addRoomDisabled}
				>
					{isAddingRoom ? <X size={17} strokeWidth={1.9} /> : <Plus size={17} strokeWidth={1.9} />}
					<span>{isAddingRoom ? "Cancel" : "Add room"}</span>
				</button>
				<button type="button" className="toolbarTool" onClick={onRecenter} title="Recenter map">
					<Focus size={17} strokeWidth={1.9} />
					<span>Focus</span>
				</button>
			</div>
			<div className="toolbarDivider" aria-hidden="true" />
			<div className="toolbarZoom" aria-label={`Map zoom ${Math.round(zoom * 100)} percent`}>
				{Math.round(zoom * 100)}%
			</div>
			<div className="toolbarHint">Scroll to zoom</div>
			<div className="toolbarStatus" aria-label={status.label} aria-live="polite">
				<StatusIcon size={14} strokeWidth={2} aria-hidden="true" />
				<span>{status.label}</span>
			</div>
		</div>
	);
}
