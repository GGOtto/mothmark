import {createHash} from "node:crypto";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";

import type {z} from "zod";

import {GameMessageSchema, GameStateSchema} from "@/schemas/states/gameStateSchemas";
import {WorldSchema} from "@/schemas/world/worldSchema";

export type StorageContractNode = {
	kind: string;
	checks?: unknown;
	defaultValue?: unknown;
	element?: StorageContractNode;
	entries?: string[];
	input?: StorageContractNode;
	key?: StorageContractNode;
	options?: StorageContractNode[];
	outputFingerprint?: string;
	properties?: Record<string, StorageContractNode>;
	value?: StorageContractNode;
	values?: unknown[];
};

export type StorageContract = {
	gameMessage: StorageContractNode;
	gameState: StorageContractNode;
	schemaSourceDigest: string;
	world: StorageContractNode;
};

const hashText = (value: string): string => createHash("sha256").update(value).digest("hex");

const canonicalJsonValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(canonicalJsonValue);
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalJsonValue(child)]),
		);
	return value;
};

const canonicalJson = (value: unknown): string | undefined =>
	JSON.stringify(canonicalJsonValue(value));

function serializable(value: unknown, seen = new WeakSet<object>()): unknown {
	if (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	)
		return value;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "function") return {function: true};
	if (value instanceof RegExp) return {flags: value.flags, source: value.source};
	if (value instanceof Date) return value.toISOString();
	if (value instanceof Set) return [...value].map((entry) => serializable(entry, seen));
	if (value instanceof Map)
		return [...value.entries()].map(([key, child]) => [
			serializable(key, seen),
			serializable(child, seen),
		]);
	if (Array.isArray(value)) return value.map((entry) => serializable(entry, seen));
	if (!value || typeof value !== "object") return String(value);
	if (seen.has(value)) return {recursive: true};
	seen.add(value);
	const output = Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.filter(([key]) => !["shape", "innerType", "element", "options", "in", "out"].includes(key))
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, serializable(child, seen)]),
	);
	seen.delete(value);
	return output;
}

function schemaSourceDigest(): string {
	const roots = [
		path.join(process.cwd(), "src/schemas"),
		path.join(process.cwd(), "src/utils/idUtils.ts"),
	];
	const files: string[] = [];
	const visit = (target: string): void => {
		if (target.endsWith(".ts")) {
			if (!target.includes(".test.")) files.push(target);
			return;
		}
		for (const entry of readdirSync(target, {withFileTypes: true})) {
			visit(path.join(target, entry.name));
		}
	};
	roots.forEach(visit);
	return hashText(
		files
			.sort()
			.map((file) => `${path.relative(process.cwd(), file)}\n${readFileSync(file, "utf8")}`)
			.join("\n"),
	);
}

const checkContract = (checks: unknown): unknown =>
	Array.isArray(checks)
		? checks.map((check) => {
				const definition = (check as {_zod?: {def?: unknown}})?._zod?.def;
				return serializable(definition ?? check);
			})
		: undefined;

function nodeFor(schema: z.ZodType, active = new WeakSet<object>()): StorageContractNode {
	const schemaObject = schema as unknown as object;
	if (active.has(schemaObject)) return {kind: "recursive"};
	active.add(schemaObject);
	const definition = (schema as unknown as {_zod: {def: Record<string, unknown>}})._zod.def;
	const kind = String(definition.type);
	const node: StorageContractNode = {kind};
	const checks = checkContract(definition.checks);
	if (checks !== undefined && JSON.stringify(checks) !== "[]") node.checks = checks;

	if (kind === "object") {
		const shapeValue = definition.shape;
		const shape =
			typeof shapeValue === "function"
				? (shapeValue() as Record<string, z.ZodType>)
				: (shapeValue as Record<string, z.ZodType>);
		node.properties = Object.fromEntries(
			Object.entries(shape)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, nodeFor(child, active)]),
		);
	}
	if (kind === "array") node.element = nodeFor(definition.element as z.ZodType, active);
	if (["optional", "nullable", "default", "prefault", "catch", "readonly"].includes(kind)) {
		node.input = nodeFor(definition.innerType as z.ZodType, active);
	}
	if (kind === "default" || kind === "prefault") {
		const defaultValue = definition.defaultValue;
		node.defaultValue = serializable(
			typeof defaultValue === "function" ? defaultValue() : defaultValue,
		);
	}
	if (kind === "union")
		node.options = (definition.options as z.ZodType[]).map((option) => nodeFor(option, active));
	if (kind === "intersection") {
		node.options = [definition.left, definition.right].map((option) =>
			nodeFor(option as z.ZodType, active),
		);
	}
	if (kind === "record") {
		node.key = nodeFor(definition.keyType as z.ZodType, active);
		node.value = nodeFor(definition.valueType as z.ZodType, active);
	}
	if (kind === "pipe") {
		node.input = nodeFor(definition.in as z.ZodType, active);
		node.outputFingerprint = String(
			(definition.out as {_zod?: {def?: {type?: unknown}}})?._zod?.def?.type ?? "output",
		);
	}
	if (kind === "lazy") {
		const getter = definition.getter as () => z.ZodType;
		node.input = nodeFor(getter(), active);
	}
	if (kind === "literal") node.values = serializable(definition.values) as unknown[];
	if (kind === "enum")
		node.entries = Object.keys(definition.entries as Record<string, unknown>).sort();
	if (kind === "transform" || kind === "custom") {
		node.outputFingerprint = kind;
	}

	active.delete(schemaObject);
	return node;
}

export function createStorageContract(): StorageContract {
	return {
		gameMessage: nodeFor(GameMessageSchema),
		gameState: nodeFor(GameStateSchema),
		schemaSourceDigest: schemaSourceDigest(),
		world: nodeFor(WorldSchema),
	};
}

export function serializeStorageContract(contract: StorageContract): string {
	return `${JSON.stringify(contract, null, "\t")}\n`;
}

export function storageContractDigest(contract: StorageContract): string {
	return hashText(canonicalJson(contract) ?? "");
}

function acceptsMissing(node: StorageContractNode): boolean {
	return node.kind === "optional" || node.kind === "default" || node.kind === "prefault";
}

function compatibleNode(
	previous: StorageContractNode,
	candidate: StorageContractNode,
	path: string,
): string[] {
	if (canonicalJson(previous) === canonicalJson(candidate)) return [];

	if (candidate.kind === "optional") return compatibleNode(previous, candidate.input!, path);
	if (previous.kind === "optional") {
		if (!acceptsMissing(candidate)) return [`${path} no longer accepts an omitted value.`];
		return compatibleNode(previous.input!, candidate.input!, path);
	}
	if (previous.kind === "default" || previous.kind === "prefault") {
		if (
			candidate.kind !== previous.kind ||
			canonicalJson(candidate.defaultValue) !== canonicalJson(previous.defaultValue)
		)
			return [`${path} changed its stored default.`];
		return compatibleNode(previous.input!, candidate.input!, path);
	}
	if (candidate.kind === "default" || candidate.kind === "prefault") {
		return compatibleNode(previous, candidate.input!, path);
	}
	if (previous.kind !== candidate.kind)
		return [`${path} changed from ${previous.kind} to ${candidate.kind}.`];
	if (canonicalJson(previous.checks) !== canonicalJson(candidate.checks))
		return [`${path} changed its validation checks.`];

	if (previous.kind === "object") {
		const issues: string[] = [];
		for (const [key, oldChild] of Object.entries(previous.properties ?? {})) {
			const nextChild = candidate.properties?.[key];
			if (!nextChild) issues.push(`${path}.${key} was removed.`);
			else issues.push(...compatibleNode(oldChild, nextChild, `${path}.${key}`));
		}
		for (const [key, nextChild] of Object.entries(candidate.properties ?? {})) {
			if (!(key in (previous.properties ?? {})) && !acceptsMissing(nextChild))
				issues.push(`${path}.${key} is a new required field.`);
		}
		return issues;
	}
	if (previous.kind === "array")
		return compatibleNode(previous.element!, candidate.element!, `${path}[]`);
	if (previous.kind === "record")
		return [
			...compatibleNode(previous.key!, candidate.key!, `${path}{key}`),
			...compatibleNode(previous.value!, candidate.value!, `${path}{value}`),
		];
	if (previous.kind === "union") {
		const nextOptions = candidate.options ?? [];
		return (previous.options ?? []).flatMap((oldOption, index) => {
			const matches = nextOptions.some(
				(nextOption) => compatibleNode(oldOption, nextOption, `${path}|${index}`).length === 0,
			);
			return matches ? [] : [`${path} no longer accepts union option ${index}.`];
		});
	}
	if (previous.kind === "enum") {
		const nextEntries = new Set(candidate.entries ?? []);
		return (previous.entries ?? [])
			.filter((entry) => !nextEntries.has(entry))
			.map((entry) => `${path} no longer accepts enum value ${JSON.stringify(entry)}.`);
	}
	if (previous.kind === "literal") {
		const nextValues = new Set((candidate.values ?? []).map(canonicalJson));
		return (previous.values ?? [])
			.filter((value) => !nextValues.has(canonicalJson(value)))
			.map((value) => `${path} no longer accepts ${JSON.stringify(value)}.`);
	}
	if (previous.kind === "pipe") {
		if (previous.outputFingerprint !== candidate.outputFingerprint)
			return [`${path} changed its normalization transform.`];
		return compatibleNode(previous.input!, candidate.input!, path);
	}
	if (previous.kind === "lazy") return compatibleNode(previous.input!, candidate.input!, path);

	return [`${path} changed incompatibly.`];
}

export function compareStorageContracts(
	previous: StorageContract,
	candidate: StorageContract,
): string[] {
	const structuralIssues = [
		...compatibleNode(previous.world, candidate.world, "World"),
		...compatibleNode(previous.gameState, candidate.gameState, "GameState"),
		...compatibleNode(previous.gameMessage, candidate.gameMessage, "GameMessage"),
	];
	if (
		structuralIssues.length === 0 &&
		previous.schemaSourceDigest !== candidate.schemaSourceDigest &&
		canonicalJson({...previous, schemaSourceDigest: ""}) ===
			canonicalJson({...candidate, schemaSourceDigest: ""})
	)
		return [
			"Persisted schema source changed without a detectable additive contract change; use a migration.",
		];
	return structuralIssues;
}
