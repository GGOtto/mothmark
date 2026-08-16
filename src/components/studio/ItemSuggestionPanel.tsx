"use client";

import {Lightbulb, Link2, LoaderCircle, Plus} from "lucide-react";
import type {Draft} from "immer";
import {useEffect, useMemo, useState} from "react";
import {readOptionalJson} from "@/auth/apiResponse";
import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {resolveItemIcon} from "@/itemIcons";
import type {Item} from "@/schemas/world/itemSchema";
import type {World} from "@/schemas/world/worldSchema";
import {
	LexicalSuggestionResponseSchema,
	type LexicalSuggestionResponse,
} from "@/features/item-suggestions/lexicalSchemas";
import {
	applyAliasSuggestionDraft,
	applyTagSuggestionDraft,
	buildAliasCollisionIndex,
	buildWorldTagGraph,
	createAliasSuggestions,
	createTagSuggestions,
	emptyAliasSuggestionMessage,
	type AliasSuggestion,
	type TagSuggestion,
} from "@/features/item-suggestions/itemSuggestions";
import "./ItemSuggestionPanel.scss";

type SuggestionMode = "aliases" | "tags";

type ItemSuggestions = {
	aliasSuggestions: AliasSuggestion[];
	emptyAliasMessage: string;
	genericIcon: boolean;
	loading: boolean;
	problem: string | null;
	tagSuggestions: TagSuggestion[];
};

type ItemSuggestionListProps = {
	mode: SuggestionMode;
	onUpdate: (recipe: (draft: Draft<Item>) => void) => void;
	suggestions: ItemSuggestions;
};

function responseMessage(body: unknown, fallback: string): string {
	if (!body || typeof body !== "object") return fallback;
	const error = (body as {error?: unknown}).error;
	if (!error || typeof error !== "object") return fallback;
	const message = (error as {message?: unknown}).message;
	return typeof message === "string" ? message : fallback;
}

async function loadSuggestions(requestBody: string, signal: AbortSignal) {
	const csrfToken = readBrowserCsrfToken();
	if (!csrfToken) throw new Error("The editor security token is missing.");
	const response = await fetch("/api/editor/item-suggestions", {
		method: "POST",
		signal,
		headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
		body: requestBody,
	});
	const body = await readOptionalJson<unknown>(response);
	if (!response.ok) throw new Error(responseMessage(body, "Suggestions could not be loaded."));
	if (body === undefined) throw new Error("The suggestion service returned an empty response.");
	return LexicalSuggestionResponseSchema.parse(body);
}

export function useItemSuggestions(item: Item, world: World): ItemSuggestions {
	const [result, setResult] = useState<{
		key: string;
		data: LexicalSuggestionResponse["data"];
	} | null>(null);
	const [problem, setProblem] = useState<{key: string; message: string} | null>(null);
	const [worldContext] = useState(() => ({
		aliasCollisions: buildAliasCollisionIndex(world, item),
		tagGraph: buildWorldTagGraph(world, item.id),
	}));
	const requestBody = useMemo(
		() =>
			JSON.stringify({
				name: item.name.trim().slice(0, 160),
				aliases: item.aliases
					.map((alias) => alias.trim().slice(0, 160))
					.filter(Boolean)
					.slice(0, 40),
				tags: [...item.behaviors.map((behavior) => behavior.type), ...item.tags]
					.map((tag) => tag.trim().slice(0, 80))
					.filter((tag, index, tags) => Boolean(tag) && tags.indexOf(tag) === index)
					.slice(0, 80),
				iconCategory: resolveItemIcon(item).category,
			}),
		[item],
	);
	const currentResult = result?.key === requestBody ? result.data : null;
	const currentProblem = problem?.key === requestBody ? problem.message : null;

	useEffect(() => {
		if (!item.name.trim()) return;
		const controller = new AbortController();
		const timeout = globalThis.setTimeout(() => {
			void loadSuggestions(requestBody, controller.signal)
				.then((response) => {
					setProblem((current) => (current?.key === requestBody ? null : current));
					setResult({key: requestBody, data: response.data});
				})
				.catch((error: unknown) => {
					if (controller.signal.aborted) return;
					setProblem({
						key: requestBody,
						message: error instanceof Error ? error.message : "Suggestions could not be loaded.",
					});
				});
		}, 250);
		return () => {
			globalThis.clearTimeout(timeout);
			controller.abort();
		};
	}, [item.name, requestBody]);

	const aliasSuggestions = useMemo(
		() =>
			createAliasSuggestions(item, world, currentResult?.aliases ?? [], worldContext.aliasCollisions),
		[currentResult?.aliases, item, world, worldContext.aliasCollisions],
	);
	const tagSuggestions = useMemo(
		() => createTagSuggestions(item, currentResult?.concepts ?? [], worldContext.tagGraph),
		[currentResult?.concepts, item, worldContext.tagGraph],
	);
	const emptyAliasMessage = useMemo(
		() =>
			emptyAliasSuggestionMessage(item, currentResult?.aliases ?? [], worldContext.aliasCollisions),
		[currentResult?.aliases, item, worldContext.aliasCollisions],
	);

	return {
		aliasSuggestions,
		emptyAliasMessage,
		genericIcon: resolveItemIcon(item).category === "generic",
		loading: Boolean(item.name.trim()) && !currentResult && !currentProblem,
		problem: currentProblem,
		tagSuggestions,
	};
}

function AliasSuggestions({
	onAdd,
	suggestions,
}: {
	onAdd: (suggestion: AliasSuggestion) => void;
	suggestions: AliasSuggestion[];
}) {
	return (
		<ul className="itemSuggestionAliases">
			{suggestions.map((suggestion) => (
				<li key={suggestion.value}>
					<button
						type="button"
						aria-label={`Add alias ${suggestion.value}`}
						title={suggestion.reason}
						onClick={() => onAdd(suggestion)}
					>
						<Plus size={13} aria-hidden="true" />
						<span>{suggestion.value}</span>
					</button>
				</li>
			))}
		</ul>
	);
}

function TagSuggestions({
	onAdd,
	suggestions,
}: {
	onAdd: (suggestion: TagSuggestion) => void;
	suggestions: TagSuggestion[];
}) {
	return (
		<ul className="itemSuggestionTags">
			{suggestions.map((suggestion) => (
				<li key={suggestion.tag}>
					<div className="itemSuggestionTagCopy">
						<div className="itemSuggestionTagHeading">
							<strong>#{suggestion.tag}</strong>
							{suggestion.change.type === "behavior" ? <span>Capability</span> : null}
						</div>
						<p>{suggestion.enables}</p>
						{suggestion.connections.length ? (
							<div className="itemSuggestionConnections">
								<Link2 size={11} aria-hidden="true" />
								<span>
									{suggestion.connections
										.slice(0, 3)
										.map((connection) => connection.label)
										.join(" · ")}
									{suggestion.connections.length > 3 ? ` · +${suggestion.connections.length - 3}` : ""}
								</span>
							</div>
						) : null}
						{suggestion.warning ? <small>{suggestion.warning}</small> : null}
					</div>
					<button
						type="button"
						aria-label={`${suggestion.change.type === "behavior" ? "Enable" : "Add"} ${suggestion.tag}`}
						onClick={() => onAdd(suggestion)}
					>
						<Plus size={13} aria-hidden="true" />
						{suggestion.change.type === "behavior" ? "Enable" : "Add"}
					</button>
				</li>
			))}
		</ul>
	);
}

export function ItemSuggestionList({mode, onUpdate, suggestions}: ItemSuggestionListProps) {
	const visibleSuggestions =
		mode === "aliases" ? suggestions.aliasSuggestions : suggestions.tagSuggestions;
	const label = mode === "aliases" ? "Suggested aliases" : "Suggested tags";
	const emptyMessage =
		mode === "aliases"
			? suggestions.emptyAliasMessage
			: suggestions.genericIcon
				? "No supported tag connection was found."
				: "No safe new tag suggestions were found.";

	return (
		<section className={`itemSuggestionShelf itemSuggestionShelf--${mode}`} aria-label={label}>
			<header>
				<div>
					<Lightbulb size={13} aria-hidden="true" />
					<strong>{label}</strong>
				</div>
				{suggestions.loading ? (
					<span className="itemSuggestionLoading" role="status">
						<LoaderCircle size={12} aria-hidden="true" /> Looking up language…
					</span>
				) : null}
			</header>
			{suggestions.problem && visibleSuggestions.length === 0 ? (
				<p className="itemSuggestionProblem" role="alert">
					{suggestions.problem}
				</p>
			) : null}
			{!suggestions.loading && !suggestions.problem && visibleSuggestions.length === 0 ? (
				<p className="itemSuggestionEmpty" role="status">
					{emptyMessage}
				</p>
			) : null}
			{mode === "aliases" && suggestions.aliasSuggestions.length ? (
				<AliasSuggestions
					suggestions={suggestions.aliasSuggestions}
					onAdd={(accepted) => onUpdate((draft) => applyAliasSuggestionDraft(draft, accepted))}
				/>
			) : null}
			{mode === "tags" && suggestions.tagSuggestions.length ? (
				<TagSuggestions
					suggestions={suggestions.tagSuggestions}
					onAdd={(accepted) => onUpdate((draft) => applyTagSuggestionDraft(draft, accepted))}
				/>
			) : null}
		</section>
	);
}
