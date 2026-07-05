import type {LucideIcon} from "lucide-react";
import {Map, Box, Puzzle, Bug, ScrollText, Settings} from "lucide-react";
import "./LeftSideBar.css";

type NavItem = {
	label: string;
	icon: LucideIcon;
	href: string;
};

const editorNavItems: NavItem[] = [
	{
		label: "Map",
		icon: Map,
		href: "/editor/map",
	},
	{
		label: "World",
		icon: Box,
		href: "/editor/world",
	},
	{
		label: "Logic",
		icon: Puzzle,
		href: "/editor/logic",
	},
	{
		label: "Issues",
		icon: Bug,
		href: "/editor/issues",
	},
];

const utilityNavItems: NavItem[] = [
	{
		label: "World Settings",
		icon: ScrollText,
		href: "/editor/world-settings",
	},
	{
		label: "Settings",
		icon: Settings,
		href: "/editor/editor-settings",
	},
];

type SideBarButtonProps = {
	navItem: NavItem;
};

function SideBarButton({navItem}: SideBarButtonProps) {
	const Icon = navItem.icon;
	const words = navItem.label.split(" ");

	return (
		<button type="button" aria-label={navItem.label} className="sideBarButton">
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

export function LeftSideBar() {
	return (
		<aside className="leftSideBar">
			<div className="leftSideBarGroup leftSideBarMainGroup">
				{editorNavItems.map((button) => (
					<SideBarButton key={button.label} navItem={button} />
				))}
			</div>

			<div className="leftSideBarGroup leftSideBarBottomGroup">
				{utilityNavItems.map((button) => (
					<SideBarButton key={button.label} navItem={button} />
				))}
			</div>
		</aside>
	);
}
