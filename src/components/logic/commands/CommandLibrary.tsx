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

export function CommandLibrary({
	world,
	updateWorld,
	onOpenCommand,
}: {
	world: World;
	updateWorld: UpdateWorld;
	onOpenCommand: (commandId: string) => void;
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
			<header className="commandLibrary__header">
				<div>
					<span className="commandLibrary__icon">
						<CommandIcon size={18} aria-hidden="true" />
					</span>
					<div>
						<h1>Commands</h1>
						<p>Choose a command to edit its wording and behavior.</p>
					</div>
				</div>
				<button type="button" onClick={addCommand}>
					<Plus size={15} aria-hidden="true" /> New command
				</button>
			</header>

			<div className="commandLibrary__surface">
				<section className="commandLibrary__browser" aria-label="Available commands">
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
					<div className="commandLibrary__list">
						{commands.map((command) => (
							<button
								type="button"
								key={idValue(command.id)}
								className={`${idValue(command.id) === idValue(previewedCommand?.id) ? "is-previewed" : ""} ${!command.enabled ? "is-disabled" : ""}`}
								onMouseEnter={() => setPreviewedCommandId(idValue(command.id))}
								onFocus={() => setPreviewedCommandId(idValue(command.id))}
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

				<aside className="commandLibrary__preview" aria-live="polite">
					{previewedCommand ? (
						<>
							<header>
								<span>
									<CommandIcon size={18} aria-hidden="true" />
								</span>
								<div>
									<h2>{previewedCommand.name || "Unnamed command"}</h2>
									<p>{previewedCommand.enabled ? "Enabled" : "Disabled"}</p>
								</div>
							</header>
							<section>
								<h3>Player wording</h3>
								<CommandSummary pattern={previewedCommand.patterns[0]} />
							</section>
							<dl>
								<div>
									<dt>
										{previewedCommand.scope.scope === "global" ? (
											<Globe2 size={14} />
										) : (
											<MapPinned size={14} />
										)}
									</dt>
									<dd>
										<strong>Scope</strong>
										<span>{scopeLabel(previewedCommand)}</span>
									</dd>
								</div>
								<div>
									<dt>{previewedCommand.patterns.length}</dt>
									<dd>
										<strong>Patterns</strong>
										<span>Accepted arrangements</span>
									</dd>
								</div>
								<div>
									<dt>{behaviorCount(previewedCommand)}</dt>
									<dd>
										<strong>Branches</strong>
										<span>Command behavior</span>
									</dd>
								</div>
								<div>
									<dt>{previewedCommand.fallbacks.length}</dt>
									<dd>
										<strong>Fallbacks</strong>
										<span>Partial matches</span>
									</dd>
								</div>
							</dl>
							<button
								type="button"
								className="commandLibrary__open"
								onClick={() => onOpenCommand(idValue(previewedCommand.id))}
							>
								Edit command
							</button>
						</>
					) : (
						<p className="commandLibrary__empty">Create a command to begin.</p>
					)}
				</aside>
			</div>
		</div>
	);
}
