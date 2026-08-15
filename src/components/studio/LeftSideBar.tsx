"use client";

import type {LucideIcon} from "lucide-react";
import {Map, Key, Puzzle, Bug, ScrollText, Settings, ChevronDown} from "lucide-react";
import {useRef, useState} from "react";
import {AnchoredLayer} from "@/components/overlay/Overlay";
import "./LeftSideBar.scss";

export type EditorTab = "map" | "world" | "logic" | "debug" | "world-settings" | "editor-settings";

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
		label: "Items",
		icon: Key,
	},
	{
		id: "logic",
		label: "Logic",
		icon: Puzzle,
	},
	{
		id: "debug",
		label: "Debug",
		icon: Bug,
	},
];

const utilityNavItems: NavItem[] = [
	{
		id: "world-settings",
		label: "World settings",
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
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
	const activeNavItem = [...editorNavItems, ...utilityNavItems].find(
		(item) => item.id === activeTab,
	)!;
	const ActiveIcon = activeNavItem.icon;

	function chooseTab(tab: EditorTab) {
		onTabChange(tab);
		setMobileMenuOpen(false);
	}

	return (
		<>
			<aside className="leftSideBar" aria-label="Editor destinations">
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

			<nav className="mobileEditorNavigation" aria-label="Editor destinations">
				<button
					type="button"
					className="mobileEditorNavigationTrigger"
					aria-haspopup="menu"
					aria-expanded={mobileMenuOpen}
					onClick={() => setMobileMenuOpen((open) => !open)}
					ref={mobileTriggerRef}
				>
					<ActiveIcon size={18} aria-hidden="true" />
					<span>{activeNavItem.label}</span>
					<ChevronDown size={17} aria-hidden="true" />
				</button>

				{mobileMenuOpen ? (
					<AnchoredLayer
						anchorRef={mobileTriggerRef}
						ariaLabel="Editor destinations"
						className="mobileEditorNavigationMenu"
						onClose={() => setMobileMenuOpen(false)}
						role="menu"
					>
						{[...editorNavItems, ...utilityNavItems].map((item) => {
							const Icon = item.icon;
							return (
								<button
									type="button"
									role="menuitem"
									aria-current={activeTab === item.id ? "page" : undefined}
									onClick={() => chooseTab(item.id)}
									key={item.id}
								>
									<Icon size={18} aria-hidden="true" />
									<span>{item.label}</span>
								</button>
							);
						})}
					</AnchoredLayer>
				) : null}
			</nav>
		</>
	);
}
