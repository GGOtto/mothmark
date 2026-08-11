import {produce} from "immer";
import {helpCommand, listExitsCommand, rawInitialCommands} from "@/data/commands/initialCommands";
import {toID} from "@/utils/idUtils";
import {createPlayerTestScenario} from "../utils/testUtils";
import {availableExitsMessage, commandHelpMessage} from "./playerGuidance";

describe("player guidance", () => {
	it("lists only exits accepted by the movement privacy boundary", () => {
		const scenario = createPlayerTestScenario("navigation");
		expect(availableExitsMessage(scenario.world, scenario.game)).toBe("Available exits: east.");

		const locked = produce(scenario.game, (draft) => {
			draft.roomStates.find((room) => room.id.id === "foyer")?.lockedExits.push("e");
		});
		expect(availableExitsMessage(scenario.world, locked)).toBe("There are no visible exits.");

		const inactive = produce(scenario.game, (draft) => {
			const gallery = draft.roomStates.find((room) => room.id.id === "gallery");
			if (gallery) gallery.flags.active = false;
		});
		expect(availableExitsMessage(scenario.world, inactive)).toBe("There are no visible exits.");
	});

	it("uses only opted-in player copy without probing targets or hidden behavior", () => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			const secretCommand = produce(helpCommand, (command) => {
				command.id = toID("command", "whisper-secret-name");
				command.name = "Whisper the secret archive name";
				command.helpPattern = "whisper <words>";
				command.helpDescription = "Speak quietly.";
				const block = command.patterns[0].blocks[0];
				if (block.type === "phrase") {
					block.id = toID("command-block", "secret-phrase");
					block.matches = ["whisper mothmark", "whisper the hidden room name"];
				}
			});
			const disabled = produce(secretCommand, (command) => {
				command.id = toID("command", "disabled-command");
				command.enabled = false;
				command.helpPattern = "disabled secret";
			});
			const outOfScope = produce(secretCommand, (command) => {
				command.id = toID("command", "gallery-command");
				command.scope = {scope: "rooms", roomIds: [toID("room", "gallery")]};
				command.helpPattern = "gallery secret";
			});
			draft.commands = [helpCommand, secretCommand, disabled, outOfScope];
		});

		const message = commandHelpMessage(world, scenario.game);
		expect(message).toContain("help — Show useful commands.");
		expect(message).toContain("whisper <words> — Speak quietly.");
		expect(message).not.toContain("mothmark");
		expect(message).not.toContain("hidden room");
		expect(message).not.toContain("disabled secret");
		expect(message).not.toContain("gallery secret");
	});

	it("groups a long built-in command list into readable sections", () => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			draft.commands = rawInitialCommands;
		});

		const message = commandHelpMessage(world, scenario.game);
		expect(message.match(/Useful commands:/g)).toHaveLength(1);
		expect(message.match(/More commands:/g)).toHaveLength(2);
		expect(message).not.toContain("command-block");
	});

	it("has a useful empty state when no command is opted in", () => {
		const scenario = createPlayerTestScenario("navigation");
		const world = produce(scenario.world, (draft) => {
			draft.commands = [
				produce(helpCommand, (command) => {
					command.showInHelp = false;
				}),
				produce(listExitsCommand, (command) => {
					command.showInHelp = false;
				}),
			];
		});

		expect(commandHelpMessage(world, scenario.game)).toBe(
			"No commands are currently listed. Try commands again when your surroundings change.",
		);
	});
});
