import {CommandSchema} from "@/schemas/world/commandSchemas";
import lookCommandDocument from "./look.json";
import moveCommandDocument from "./move.json";
import takeCommandDocument from "./take.json";
import examineCommandDocument from "./examine.json";
import useCommandDocument from "./use.json";
import useTargetCommandDocument from "./use-target.json";
import dropCommandDocument from "./drop.json";
import openCommandDocument from "./open.json";
import closeCommandDocument from "./close.json";
import lockCommandDocument from "./lock.json";
import unlockCommandDocument from "./unlock.json";
import putInsideCommandDocument from "./put-inside.json";
import putOnCommandDocument from "./put-on.json";
import helpCommandDocument from "./help.json";
import listExitsCommandDocument from "./list-exits.json";

export const moveCommand = CommandSchema.parse(moveCommandDocument);
export const lookCommand = CommandSchema.parse(lookCommandDocument);
export const takeCommand = CommandSchema.parse(takeCommandDocument);
export const examineCommand = CommandSchema.parse(examineCommandDocument);
export const useCommand = CommandSchema.parse(useCommandDocument);
export const useTargetCommand = CommandSchema.parse(useTargetCommandDocument);
export const dropCommand = CommandSchema.parse(dropCommandDocument);
export const openCommand = CommandSchema.parse(openCommandDocument);
export const closeCommand = CommandSchema.parse(closeCommandDocument);
export const lockCommand = CommandSchema.parse(lockCommandDocument);
export const unlockCommand = CommandSchema.parse(unlockCommandDocument);
export const putInsideCommand = CommandSchema.parse(putInsideCommandDocument);
export const putOnCommand = CommandSchema.parse(putOnCommandDocument);
export const helpCommand = CommandSchema.parse(helpCommandDocument);
export const listExitsCommand = CommandSchema.parse(listExitsCommandDocument);

export const rawInitialCommands = [
	helpCommand,
	listExitsCommand,
	moveCommand,
	lookCommand,
	takeCommand,
	dropCommand,
	examineCommand,
	openCommand,
	closeCommand,
	lockCommand,
	unlockCommand,
	useCommand,
	useTargetCommand,
	putInsideCommand,
	putOnCommand,
];
