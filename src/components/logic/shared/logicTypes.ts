export type LogicSection = "home" | "events" | "commands" | "conditions" | "effects";

export type LogicSelection =
	| {kind: "event"; eventId: string}
	| {kind: "condition"; eventId: string; branch: "if" | "elif"; elifIndex?: number}
	| {kind: "effect-group"; eventId: string; effectId: string};

export type CommandSelection =
	| {kind: "command"; commandId: string}
	| {kind: "block"; commandId: string; patternIndex: number; blockId: string}
	| {kind: "behavior"; commandId: string}
	| {kind: "fallback"; commandId: string; blockId: string}
	| {
			kind: "behavior-condition";
			commandId: string;
			behavior: "command" | "fallback";
			blockId?: string;
			branch: "if" | "elif";
			elifIndex?: number;
	  }
	| {
			kind: "behavior-effect";
			commandId: string;
			behavior: "command" | "fallback";
			blockId?: string;
			branch: "always" | "if" | "elif" | "else";
			elifIndex?: number;
	  };
