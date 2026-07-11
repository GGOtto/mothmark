import type {LucideIcon} from "lucide-react";
import {Map, Box, Puzzle, Bug, ScrollText, Settings} from "lucide-react";
import "./LeftSideBar.scss";

export type EditorTab = "map" | "world" | "logic" | "issues" | "world-settings" | "editor-settings";

type NavItem = {
	id: EditorTab;
	label: string;
	icon: LucideIcon;
};

const editorNavItems: NavItem[] = [
	{
		id: "map",
		label: "Map",
		icon: Map,
	},
	{
		id: "world",
		label: "World",
		icon: Box,
	},
	{
		id: "logic",
		label: "Logic",
		icon: Puzzle,
	},
	{
		id: "issues",
		label: "Issues",
		icon: Bug,
	},
];

const utilityNavItems: NavItem[] = [
	{
		id: "world-settings",
		label: "World Settings",
		icon: ScrollText,
	},
	{
		id: "editor-settings",
		label: "Settings",
		icon: Settings,
	},
];

type SideBarButtonProps = {
	navItem: NavItem;
	isActive: boolean;
	onClick: (tab: EditorTab) => void;
};

function SideBarButton({navItem, isActive, onClick}: SideBarButtonProps) {
	const Icon = navItem.icon;
	const words = navItem.label.split(" ");

	return (
		<button
			type="button"
			aria-label={navItem.label}
			aria-current={isActive ? "page" : undefined}
			className={`sideBarButton ${isActive ? "sideBarButtonActive" : ""}`}
			onClick={() => onClick(navItem.id)}
		>
			<span className="sideBarIcon">
				<Icon size={23} strokeWidth={2.1} />
			</span>

			<span className="sideBarLabel" aria-hidden="true">
				{words.map((word) => (
					<span className="sideBarLabelWord" key={word}>
						{word}
					</span>
				))}
			</span>
		</button>
	);
}

type LeftSideBarProps = {
	activeTab: EditorTab;
	onTabChange: (tab: EditorTab) => void;
};

export function LeftSideBar({activeTab, onTabChange}: LeftSideBarProps) {
	return (
		<aside className="leftSideBar">
			<div className="leftSideBarGroup leftSideBarMainGroup">
				{editorNavItems.map((button) => (
					<SideBarButton
						key={button.id}
						navItem={button}
						isActive={activeTab === button.id}
						onClick={onTabChange}
					/>
				))}
			</div>

			<div className="leftSideBarGroup leftSideBarBottomGroup">
				{utilityNavItems.map((button) => (
					<SideBarButton
						key={button.id}
						navItem={button}
						isActive={activeTab === button.id}
						onClick={onTabChange}
					/>
				))}
			</div>
		</aside>
	);
}
