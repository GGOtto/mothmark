import {CommandSchema} from "@/schemas/world/commandSchemas";
import lookCommandDocument from "./look.json";
import moveCommandDocument from "./move.json";

export const moveCommand = CommandSchema.parse(moveCommandDocument);
export const lookCommand = CommandSchema.parse(lookCommandDocument);

export const rawInitialCommands = [moveCommand, lookCommand];
