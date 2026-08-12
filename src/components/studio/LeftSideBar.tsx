"use client";

import type {LucideIcon} from "lucide-react";
import {Map, Key, Puzzle, Bug, ScrollText, Settings, VenetianMask, ChevronDown} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import "./LeftSideBar.scss";

export type EditorTab =
	"map" | "world" | "logic" | "npcs" | "debug" | "world-settings" | "editor-settings";

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
		id: "npcs",
		label: "NPCs",
		icon: VenetianMask,
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
	const mobileNavigationRef = useRef<HTMLElement | null>(null);
	const mobileTriggerRef = useRef<HTMLButtonElement | null>(null);
	const activeNavItem = [...editorNavItems, ...utilityNavItems].find(
		(item) => item.id === activeTab,
	)!;
	const ActiveIcon = activeNavItem.icon;

	useEffect(() => {
		if (!mobileMenuOpen) return;

		function closeOutside(event: PointerEvent) {
			if (event.target instanceof Node && !mobileNavigationRef.current?.contains(event.target)) {
				setMobileMenuOpen(false);
			}
		}

		function closeOnEscape(event: KeyboardEvent) {
			if (event.key !== "Escape") return;
			setMobileMenuOpen(false);
			mobileTriggerRef.current?.focus();
		}

		document.addEventListener("pointerdown", closeOutside, true);
		document.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOutside, true);
			document.removeEventListener("keydown", closeOnEscape);
		};
	}, [mobileMenuOpen]);

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

			<nav
				className="mobileEditorNavigation"
				aria-label="Editor destinations"
				ref={mobileNavigationRef}
			>
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
					<div className="mobileEditorNavigationMenu" role="menu">
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
					</div>
				) : null}
			</nav>
		</>
	);
}
