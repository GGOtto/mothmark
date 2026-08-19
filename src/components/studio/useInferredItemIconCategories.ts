"use client";

import {useEffect, useMemo, useState} from "react";
import {readOptionalJson} from "@/auth/apiResponse";
import {readBrowserCsrfToken} from "@/auth/browserCsrf";
import {ITEM_ICON_CATEGORIES, resolveItemIcon, type ItemIconCategory} from "@/itemIcons";
import {
	ItemIconInferenceBatchResponseSchema,
	type ItemIconInferenceBatchRequest,
} from "@/features/item-suggestions/lexicalSchemas";
import type {Item} from "@/schemas/world/itemSchema";
import {idValue} from "@/utils/idUtils";

const BATCH_SIZE = 20;
const categorySet = new Set<string>(ITEM_ICON_CATEGORIES);
const inferredCategoryCache = new Map<string, ItemIconCategory>();

type InferenceEntry = {
	id: string;
	key: string;
	request: ItemIconInferenceBatchRequest["items"][number];
	fallback: ItemIconCategory;
};

function inferenceEntry(item: Item): InferenceEntry {
	const fallback = resolveItemIcon(item).category;
	const request = {
		name: item.name.trim().slice(0, 160),
		aliases: item.aliases
			.map((alias) => alias.trim().slice(0, 160))
			.filter(Boolean)
			.slice(0, 8),
		tags: [...item.behaviors.map(({type}) => type), ...item.tags]
			.map((tag) => tag.trim().slice(0, 80))
			.filter((tag, index, tags) => Boolean(tag) && tags.indexOf(tag) === index)
			.slice(0, 20),
		iconCategory: fallback,
	};
	return {id: idValue(item.id), key: JSON.stringify(request), request, fallback};
}

async function loadBatch(entries: readonly InferenceEntry[], signal: AbortSignal) {
	const csrfToken = readBrowserCsrfToken();
	if (!csrfToken) return;
	try {
		const response = await fetch("/api/editor/item-icon-suggestions", {
			method: "POST",
			signal,
			headers: {"content-type": "application/json", "x-csrf-token": csrfToken},
			body: JSON.stringify({items: entries.map(({request}) => request)}),
		});
		const body = await readOptionalJson<unknown>(response);
		if (!response.ok || body === undefined) return;
		const parsed = ItemIconInferenceBatchResponseSchema.safeParse(body);
		if (!parsed.success || parsed.data.data.categories.length !== entries.length) return;
		parsed.data.data.categories.forEach((category, index) => {
			const entry = entries[index];
			if (entry && categorySet.has(category)) {
				inferredCategoryCache.set(entry.key, category as ItemIconCategory);
			}
		});
	} catch {
		// Icon inference is cosmetic; cancellation and transient failures keep the local fallback.
	}
}

export function useInferredItemIconCategories(
	items: readonly Item[],
): Map<string, ItemIconCategory> {
	const entries = useMemo(() => items.filter(({name}) => name.trim()).map(inferenceEntry), [items]);
	const requestKey = entries.map(({id, key}) => `${id}:${key}`).join("|");
	const [completedKey, setCompletedKey] = useState("");

	useEffect(() => {
		const missing = entries.filter(({key}) => !inferredCategoryCache.has(key));
		if (!missing.length) {
			queueMicrotask(() => setCompletedKey(requestKey));
			return;
		}
		const controller = new AbortController();
		void Promise.all(
			Array.from({length: Math.ceil(missing.length / BATCH_SIZE)}, (_, index) =>
				loadBatch(missing.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE), controller.signal),
			),
		).then(() => {
			if (!controller.signal.aborted) setCompletedKey(requestKey);
		});
		return () => controller.abort();
	}, [entries, requestKey]);

	return useMemo(
		() =>
			new Map(entries.map(({id, key, fallback}) => [id, inferredCategoryCache.get(key) ?? fallback])),
		// completedKey intentionally invalidates this derived cache after inference finishes.
		[completedKey, entries],
	);
}
