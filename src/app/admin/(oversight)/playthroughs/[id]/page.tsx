"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {OutputLog} from "@/components/player/OutputLog";
import type {GameMessage, GameState} from "@/schemas/states/gameStateSchemas";

import {formatAdminDate, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminPlaythrough} from "../../../adminTypes";

type Detail = AdminPlaythrough & {
	commands: string;
	transcript: GameMessage[];
	initialState: GameState;
	currentState: GameState;
	engineVersion: string;
	worldId: string;
	worldVersionId: string;
	stateSummary: {
		currentRoom: string;
		turns: number;
		inventory: string[];
		importantFlags: string[];
		playerStatus: string;
	};
};
type Diagnostic = {
	available: boolean;
	label: string;
	engineVersion: string;
	commandCount: number;
	firstDifference: number | null;
	message?: string;
	steps: Array<{
		sequence: number;
		command: string;
		recordedOutput: GameMessage[];
		replayedOutput: GameMessage[];
		outputDiffers: boolean;
		stateDiffers: boolean;
		stateSummary: string | null;
	}>;
};

export default function AdminPlaythroughDetailPage() {
	const id = String(useParams<{id: string}>().id);
	const [playthrough, setPlaythrough] = useState<Detail | null>(null);
	const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
	const [selectedStep, setSelectedStep] = useState(0);
	const [working, setWorking] = useState(false);
	const [error, setError] = useState("");
	const [narrowTab, setNarrowTab] = useState<"transcript" | "state">("transcript");

	useEffect(() => {
		readAdminJson<{data: Detail}>(`/api/admin/playthroughs/${id}`)
			.then((result) => setPlaythrough(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "The playthrough could not be loaded."),
			);
	}, [id]);

	const run = async (type: "original" | "current_release" | "editor") => {
		setWorking(true);
		setError("");
		try {
			const result = await mutateAdminJson<{data: Diagnostic}>(
				`/api/admin/playthroughs/${id}/diagnostics`,
				"POST",
				{type},
			);
			setDiagnostic(result.data);
			setSelectedStep(Math.max(0, (result.data.firstDifference ?? 1) - 1));
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The diagnostic could not be run.");
		} finally {
			setWorking(false);
		}
	};

	const downloadCommands = () => {
		if (!playthrough) return;
		const url = URL.createObjectURL(new Blob([playthrough.commands], {type: "text/plain"}));
		const link = document.createElement("a");
		link.href = url;
		link.download = `mothmark-playthrough-${playthrough.id}.txt`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const step = diagnostic?.steps[selectedStep];
	return (
		<main className="adminPage adminPlaythroughDetail">
			<Link className="adminBackLink" href="/admin/playthroughs">
				← Playthroughs
			</Link>
			<header className="adminPageHeader">
				<div>
					<h1>{playthrough?.publicationTitle ?? "Playthrough"}</h1>
					<p>
						{playthrough
							? `${playthrough.playerReference} · release ${playthrough.releaseNumber}`
							: "Loading recorded play…"}
					</p>
				</div>
			</header>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{playthrough ? (
				<>
					<div className="adminNarrowTabs" role="tablist" aria-label="Playthrough detail">
						<button
							type="button"
							role="tab"
							aria-selected={narrowTab === "transcript"}
							onClick={() => setNarrowTab("transcript")}
						>
							Transcript
						</button>
						<button
							type="button"
							role="tab"
							aria-selected={narrowTab === "state"}
							onClick={() => setNarrowTab("state")}
						>
							State
						</button>
					</div>
					<div className="adminPlaythroughColumns">
						<section
							className={`adminRecordedTerminal ${narrowTab === "transcript" ? "isNarrowActive" : ""}`}
							aria-label="Recorded transcript"
						>
							<OutputLog messages={playthrough.transcript} />
						</section>
						<aside
							className={`adminSection adminStateSummary ${narrowTab === "state" ? "isNarrowActive" : ""}`}
						>
							<h2>Current state</h2>
							<dl className="adminDefinitionGrid">
								<div>
									<dt>Room</dt>
									<dd>{playthrough.stateSummary.currentRoom}</dd>
								</div>
								<div>
									<dt>Turns</dt>
									<dd>{playthrough.stateSummary.turns}</dd>
								</div>
								<div>
									<dt>Player</dt>
									<dd>{playthrough.stateSummary.playerStatus}</dd>
								</div>
								<div>
									<dt>Inventory</dt>
									<dd>{playthrough.stateSummary.inventory.join(", ") || "Empty"}</dd>
								</div>
								<div>
									<dt>Important flags</dt>
									<dd>{playthrough.stateSummary.importantFlags.join(", ") || "None"}</dd>
								</div>
							</dl>
							<details>
								<summary>Raw state JSON</summary>
								<pre className="adminJson">{JSON.stringify(playthrough.currentState, null, 2)}</pre>
							</details>
						</aside>
					</div>
					<section className="adminSection">
						<h2>Recorded commands</h2>
						<div className="adminButtonRow">
							<button
								type="button"
								onClick={() => void navigator.clipboard.writeText(playthrough.commands)}
							>
								Copy commands
							</button>
							<button type="button" onClick={downloadCommands}>
								Download
							</button>
						</div>
						<pre className="adminCommands">{playthrough.commands || "No commands recorded."}</pre>
						<small>
							Engine {playthrough.engineVersion} · started {formatAdminDate(playthrough.startedAt)} · last
							activity {formatAdminDate(playthrough.lastActivityAt)}
						</small>
					</section>
					<section className="adminSection">
						<h2>Diagnostic replay</h2>
						<p>
							Recorded turns remain authoritative. Replays are read-only and never alter player or world
							data.
						</p>
						<div className="adminButtonRow">
							<button type="button" disabled={working} onClick={() => void run("original")}>
								Replay with original engine
							</button>
							<button type="button" disabled={working} onClick={() => void run("current_release")}>
								Compare with current release
							</button>
							<button type="button" disabled={working} onClick={() => void run("editor")}>
								Compare with editor revision
							</button>
						</div>
						{diagnostic ? (
							<div className="adminDiagnosticResult">
								<h3>
									{diagnostic.available
										? diagnostic.firstDifference === null
											? "No observable difference"
											: `First difference at command ${diagnostic.firstDifference} of ${diagnostic.commandCount}`
										: diagnostic.label}
								</h3>
								<p>{diagnostic.message ?? `${diagnostic.label} · ${diagnostic.engineVersion}`}</p>
								{diagnostic.available && diagnostic.steps.length ? (
									<>
										<label>
											Command step{" "}
											<select
												value={selectedStep}
												onChange={(event) => setSelectedStep(Number(event.target.value))}
											>
												{diagnostic.steps.map((candidate, index) => (
													<option key={candidate.sequence} value={index}>
														{candidate.sequence}. {candidate.command}
													</option>
												))}
											</select>
										</label>
										{step ? (
											<div className="adminDiagnosticComparison">
												<div>
													<h4>Recorded output</h4>
													<OutputLog messages={step.recordedOutput} />
												</div>
												<div>
													<h4>Replayed output</h4>
													<OutputLog messages={step.replayedOutput} />
												</div>
												<p>
													{step.stateSummary ??
														(step.outputDiffers
															? "Player-visible output differs."
															: "No difference at this command.")}
												</p>
											</div>
										) : null}
									</>
								) : null}
							</div>
						) : null}
					</section>
				</>
			) : !error ? (
				<p role="status">Loading playthrough…</p>
			) : null}
		</main>
	);
}
