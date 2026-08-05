"use client";

import {Command as CommandIcon, Globe2, MapPinned, Plus, Search} from "lucide-react";
import {useMemo, useState} from "react";
import type {Command} from "@/schemas/world/commandSchemas";
import type {World} from "@/schemas/world/worldSchema";
import type {UpdateWorld} from "@/types/worldUpdaterTypes";
import {idValue} from "@/utils/idUtils";
import {createCommand} from "./CommandEditor";
import {CommandSummary, commandPatternText} from "./CommandSummary";
import "./CommandLibrary.scss";

function scopeLabel(command: Command) {
	if (command.scope.scope === "global") return "Everywhere";
	if (command.scope.scope === "rooms") {
		return `${command.scope.roomIds.length} ${command.scope.roomIds.length === 1 ? "room" : "rooms"}`;
	}
	return `${command.scope.layers.length} ${command.scope.layers.length === 1 ? "layer" : "layers"}`;
}

function behaviorCount(command: Command) {
	return [
		command.behavior.always,
		command.behavior.if,
		...(command.behavior.elifs ?? []),
		command.behavior.else,
	].filter(Boolean).length;
}

function uniquePatternSummaries(command: Command) {
	const seen = new Set<string>();
	return command.patterns.flatMap((pattern, index) => {
		const summary = commandPatternText(pattern);
		if (seen.has(summary)) return [];
		seen.add(summary);
		return [{pattern, index}];
	});
}

export function CommandLibrary({
	world,
	updateWorld,
	onOpenCommand,
	onPreviewCommand,
}: {
	world: World;
	updateWorld: UpdateWorld;
	onOpenCommand: (commandId: string) => void;
	onPreviewCommand: (commandId: string) => void;
}) {
	const [query, setQuery] = useState("");
	const [previewedCommandId, setPreviewedCommandId] = useState<string | null>(
		world.commands[0] ? idValue(world.commands[0].id) : null,
	);
	const commands = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase();
		if (!normalized) return world.commands;
		return world.commands.filter((command) =>
			`${command.name} ${command.patterns.map(commandPatternText).join(" ")}`
				.toLocaleLowerCase()
				.includes(normalized),
		);
	}, [query, world.commands]);
	const previewedCommand =
		commands.find((command) => idValue(command.id) === previewedCommandId) ?? commands[0] ?? null;

	function addCommand() {
		const command = createCommand(world);
		updateWorld((draft) => {
			draft.commands.push(command);
		});
		onOpenCommand(idValue(command.id));
	}

	return (
		<div className="commandLibrary">
			<h1 className="commandLibrary__title">Commands</h1>
			<div className="commandLibrary__surface">
				<section className="commandLibrary__browser" aria-label="Available commands">
					<div className="commandLibrary__tools">
						<label className="commandLibrary__search">
							<Search size={15} aria-hidden="true" />
							<input
								type="search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder="Find a command"
								aria-label="Find a command"
							/>
							<span>{commands.length}</span>
						</label>
						<button type="button" className="commandLibrary__new" onClick={addCommand}>
							<Plus size={15} aria-hidden="true" /> New command
						</button>
					</div>
					<div className="commandLibrary__list">
						{commands.map((command) => (
							<button
								type="button"
								key={idValue(command.id)}
								className={`${idValue(command.id) === idValue(previewedCommand?.id) ? "is-previewed" : ""} ${!command.enabled ? "is-disabled" : ""}`}
								onMouseEnter={() => {
									setPreviewedCommandId(idValue(command.id));
									onPreviewCommand(idValue(command.id));
								}}
								onFocus={() => {
									setPreviewedCommandId(idValue(command.id));
									onPreviewCommand(idValue(command.id));
								}}
								onClick={() => onOpenCommand(idValue(command.id))}
							>
								<span className="commandLibrary__rowIcon">
									<CommandIcon size={15} aria-hidden="true" />
								</span>
								<span className="commandLibrary__rowText">
									<strong>{command.name || "Unnamed command"}</strong>
									<CommandSummary pattern={command.patterns[0]} compact />
								</span>
								<span className="commandLibrary__rowScope">{scopeLabel(command)}</span>
							</button>
						))}
						{commands.length === 0 ? (
							<p className="commandLibrary__empty">No commands match that search.</p>
						) : null}
					</div>
				</section>
			</div>
		</div>
	);
}

export function CommandLibraryPreview({
	command,
	onOpenCommand,
}: {
	command: Command | null;
	onOpenCommand: (commandId: string) => void;
}) {
	return (
		<div className="commandLibraryPreview" aria-live="polite">
			{command ? (
				<>
					<header>
						<span>
							<CommandIcon size={18} aria-hidden="true" />
						</span>
						<div>
							<h2>{command.name || "Unnamed command"}</h2>
							<p>{command.enabled ? "Enabled" : "Disabled"}</p>
						</div>
					</header>
					<section>
						<h3>Patterns</h3>
						<ol className="commandLibraryPreview__patterns" aria-label="Pattern summaries">
							{uniquePatternSummaries(command).map(({pattern, index}) => (
								<li key={index}>
									<span>Pattern {index + 1}</span>
									<CommandSummary pattern={pattern} compact />
								</li>
							))}
						</ol>
					</section>
					<dl>
						<div>
							<dt>{command.scope.scope === "global" ? <Globe2 size={14} /> : <MapPinned size={14} />}</dt>
							<dd>
								<strong>Scope</strong>
								<span>{scopeLabel(command)}</span>
							</dd>
						</div>
						<div>
							<dt>{behaviorCount(command)}</dt>
							<dd>
								<strong>Branches</strong>
								<span>Command behavior</span>
							</dd>
						</div>
						<div>
							<dt>{command.fallbacks.length}</dt>
							<dd>
								<strong>Fallbacks</strong>
								<span>Partial matches</span>
							</dd>
						</div>
					</dl>
					<button
						type="button"
						className="commandLibrary__open"
						onClick={() => onOpenCommand(idValue(command.id))}
					>
						Edit command
					</button>
				</>
			) : (
				<p className="commandLibrary__empty">Create a command to begin.</p>
			)}
		</div>
	);
}
