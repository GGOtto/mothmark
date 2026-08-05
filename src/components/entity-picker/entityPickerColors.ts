import type {EntityType} from "@/types/editor/editorRegistryTypes";

export const ENTITY_TYPE_ORDER = [
	"room",
	"connection",
	"item",
	"npc",
	"character",
	"topic",
	"quest",
	"command",
	"event",
	"effect",
	"feature",
	"condition",
	"container",
	"surface",
	"object",
	"direction",
	"quest-objective",
] as const satisfies readonly EntityType[];

export const ENTITY_COLOR_PALETTE = [
	{dark: "#8db6cf", light: "#496b83"},
	{dark: "#9caf88", light: "#526b45"},
	{dark: "#c6a15b", light: "#7a5a1d"},
	{dark: "#c9856b", light: "#8a4935"},
	{dark: "#a99ac4", light: "#665782"},
	{dark: "#79b3aa", light: "#3f716a"},
	{dark: "#c58a9d", light: "#85495d"},
	{dark: "#a9aa6a", light: "#62652d"},
	{dark: "#879bc8", light: "#475c8c"},
	{dark: "#bb8a61", light: "#744a29"},
	{dark: "#83a98c", light: "#41694a"},
	{dark: "#b18aa8", light: "#754c6d"},
	{dark: "#c0a982", light: "#735d39"},
	{dark: "#8fa7b2", light: "#506873"},
	{dark: "#b9776d", light: "#7c4039"},
	{dark: "#78a17a", light: "#3e6940"},
	{dark: "#999fcb", light: "#565e91"},
	{dark: "#c09655", light: "#79541d"},
	{dark: "#72a8b4", light: "#396d78"},
	{dark: "#ae8d98", light: "#704f5a"},
] as const;

export function entityColorFor(type: EntityType) {
	const index = ENTITY_TYPE_ORDER.indexOf(type);
	return ENTITY_COLOR_PALETTE[Math.max(0, index) % ENTITY_COLOR_PALETTE.length];
}
