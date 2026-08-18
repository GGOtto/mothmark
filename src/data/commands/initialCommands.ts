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
import faceCommandDocument from "./face.json";
import equipCommandDocument from "./equip.json";
import readCommandDocument from "./read.json";
import senseCommandDocument from "./sense.json";
import searchCommandDocument from "./search.json";
import eatCommandDocument from "./eat.json";
import drinkCommandDocument from "./drink.json";
import switchCommandDocument from "./switch.json";
import lightItemCommandDocument from "./light-item.json";
import makeSoundCommandDocument from "./make-sound.json";
import moveItemCommandDocument from "./move-item.json";
import climbItemCommandDocument from "./climb-item.json";
import restOnItemCommandDocument from "./rest-on-item.json";
import enterItemCommandDocument from "./enter-item.json";
import rideItemCommandDocument from "./ride-item.json";
import tieItemCommandDocument from "./tie-item.json";
import untieItemCommandDocument from "./untie-item.json";
import breakItemCommandDocument from "./break-item.json";
import cutItemCommandDocument from "./cut-item.json";
import cutItemWithToolCommandDocument from "./cut-item-with-tool.json";
import liquidContainerCommandDocument from "./liquid-container.json";
import fillFromCommandDocument from "./fill-from.json";
import pourIntoCommandDocument from "./pour-into.json";
import cleanItemCommandDocument from "./clean-item.json";
import repairItemCommandDocument from "./repair-item.json";
import repairItemWithToolCommandDocument from "./repair-item-with-tool.json";
import writeOnItemCommandDocument from "./write-on-item.json";
import eraseItemCommandDocument from "./erase-item.json";
import throwItemCommandDocument from "./throw-item.json";
import throwItemAtCommandDocument from "./throw-item-at.json";
import presentItemCommandDocument from "./present-item.json";

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
export const faceCommand = CommandSchema.parse(faceCommandDocument);
export const equipCommand = CommandSchema.parse(equipCommandDocument);
export const readCommand = CommandSchema.parse(readCommandDocument);
export const senseCommand = CommandSchema.parse(senseCommandDocument);
export const searchCommand = CommandSchema.parse(searchCommandDocument);
export const eatCommand = CommandSchema.parse(eatCommandDocument);
export const drinkCommand = CommandSchema.parse(drinkCommandDocument);
export const switchCommand = CommandSchema.parse(switchCommandDocument);
export const lightItemCommand = CommandSchema.parse(lightItemCommandDocument);
export const makeSoundCommand = CommandSchema.parse(makeSoundCommandDocument);
export const moveItemCommand = CommandSchema.parse(moveItemCommandDocument);
export const climbItemCommand = CommandSchema.parse(climbItemCommandDocument);
export const restOnItemCommand = CommandSchema.parse(restOnItemCommandDocument);
export const enterItemCommand = CommandSchema.parse(enterItemCommandDocument);
export const rideItemCommand = CommandSchema.parse(rideItemCommandDocument);
export const tieItemCommand = CommandSchema.parse(tieItemCommandDocument);
export const untieItemCommand = CommandSchema.parse(untieItemCommandDocument);
export const breakItemCommand = CommandSchema.parse(breakItemCommandDocument);
export const cutItemCommand = CommandSchema.parse(cutItemCommandDocument);
export const cutItemWithToolCommand = CommandSchema.parse(cutItemWithToolCommandDocument);
export const liquidContainerCommand = CommandSchema.parse(liquidContainerCommandDocument);
export const fillFromCommand = CommandSchema.parse(fillFromCommandDocument);
export const pourIntoCommand = CommandSchema.parse(pourIntoCommandDocument);
export const cleanItemCommand = CommandSchema.parse(cleanItemCommandDocument);
export const repairItemCommand = CommandSchema.parse(repairItemCommandDocument);
export const repairItemWithToolCommand = CommandSchema.parse(repairItemWithToolCommandDocument);
export const writeOnItemCommand = CommandSchema.parse(writeOnItemCommandDocument);
export const eraseItemCommand = CommandSchema.parse(eraseItemCommandDocument);
export const throwItemCommand = CommandSchema.parse(throwItemCommandDocument);
export const throwItemAtCommand = CommandSchema.parse(throwItemAtCommandDocument);
export const presentItemCommand = CommandSchema.parse(presentItemCommandDocument);

export const rawInitialCommands = [
	helpCommand,
	listExitsCommand,
	moveCommand,
	faceCommand,
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
	equipCommand,
	readCommand,
	senseCommand,
	searchCommand,
	eatCommand,
	drinkCommand,
	switchCommand,
	lightItemCommand,
	makeSoundCommand,
	moveItemCommand,
	climbItemCommand,
	restOnItemCommand,
	enterItemCommand,
	rideItemCommand,
	tieItemCommand,
	untieItemCommand,
	breakItemCommand,
	cutItemCommand,
	cutItemWithToolCommand,
	liquidContainerCommand,
	fillFromCommand,
	pourIntoCommand,
	cleanItemCommand,
	repairItemCommand,
	repairItemWithToolCommand,
	writeOnItemCommand,
	eraseItemCommand,
	throwItemCommand,
	throwItemAtCommand,
	presentItemCommand,
];
