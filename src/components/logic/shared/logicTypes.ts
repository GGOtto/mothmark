export type LogicSection = "home" | "events" | "commands" | "conditions" | "effects";

export type LogicSelection =
	| {kind: "event"; eventId: string}
	| {kind: "condition"; eventId: string; branch: "if" | "elif"; elifIndex?: number}
	| {kind: "effect-group"; eventId: string; effectId: string};
