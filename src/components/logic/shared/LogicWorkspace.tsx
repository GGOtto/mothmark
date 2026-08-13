"use client";

import {Braces, Command, GitBranch, Sparkles} from "lucide-react";
import type {LogicSection} from "./logicTypes";
import "./LogicWorkspace.scss";

const LOGIC_SECTIONS = [
	{
		id: "events",
		title: "Events",
		description: "Run effects through conditional branches.",
		icon: GitBranch,
	},
	{
		id: "commands",
		title: "Commands",
		description: "Define the commands available to the player.",
		icon: Command,
	},
	{
		id: "conditions",
		title: "Conditions",
		description: "Build, find, and manage reusable condition groups.",
		icon: Braces,
	},
	{
		id: "effects",
		title: "Effects",
		description: "Build, find, and manage reusable effect groups.",
		icon: Sparkles,
	},
] satisfies Array<{
	id: Exclude<LogicSection, "home">;
	title: string;
	description: string;
	icon: typeof GitBranch;
}>;

export function LogicHome({onOpen}: {onOpen: (section: Exclude<LogicSection, "home">) => void}) {
	return (
		<div className="logicHome">
			<div className="logicHome__content">
				<h1>Logic</h1>
				<p>Choose what you want to build.</p>
				<div className="logicHome__grid">
					{LOGIC_SECTIONS.map((section) => {
						const Icon = section.icon;
						return (
							<button type="button" key={section.id} onClick={() => onOpen(section.id)}>
								<Icon size={20} aria-hidden="true" />
								<span>
									<strong>{section.title}</strong>
									<small>{section.description}</small>
								</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
