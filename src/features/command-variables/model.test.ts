import {
	BooleanBlockSchema,
	CommandSchema,
	DirectionBlockSchema,
	NumberBlockSchema,
	PatternSchema,
	PhraseBlockSchema,
	RelationBlockSchema,
	TargetBlockSchema,
} from "@/schemas/world/commandSchemas";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {CommandConditionBranchSchema} from "@/schemas/world/commandLogicSchemas";
import {buildCommandVariableCatalog, compatibleVariableOptions} from "./model";

function commandCatalog(failedTarget = false) {
	const target = {
		...createDefaultFieldObject(TargetBlockSchema),
		id: toID("command-block", "target-block"),
		role: "object",
		entityTypes: ["item" as const],
	};
	const command = CommandSchema.parse({
		...createDefaultFieldObject(CommandSchema),
		id: toID("command", "catalog-command"),
		name: "Catalog command",
		behavior: {
			...createDefaultFieldObject(CommandConditionBranchSchema),
			id: toID("condition-branch", "catalog-command-behavior"),
		},
		patterns: [
			{
				...createDefaultFieldObject(PatternSchema),
				blocks: [
					{
						...createDefaultFieldObject(PhraseBlockSchema),
						id: toID("command-block", "phrase-block"),
						matches: ["use"],
					},
					{
						...createDefaultFieldObject(RelationBlockSchema),
						id: toID("command-block", "relation-block"),
						relation: "with" as const,
					},
					target,
					{
						...createDefaultFieldObject(BooleanBlockSchema),
						id: toID("command-block", "boolean-block"),
						role: "enabled",
					},
					{
						...createDefaultFieldObject(NumberBlockSchema),
						id: toID("command-block", "number-block"),
						role: "amount",
					},
					{
						...createDefaultFieldObject(DirectionBlockSchema),
						id: toID("command-block", "direction-block"),
						role: "direction",
					},
				],
			},
		],
	});
	return buildCommandVariableCatalog(command, failedTarget ? target.id : undefined);
}

describe("command variable catalog", () => {
	it("splits entity values into entity, name, description, and entered-text choices", () => {
		const targetOptions = commandCatalog().options.filter(
			(option) => option.blockId.id === "target-block",
		);

		expect(targetOptions.map((option) => [option.projection, option.valueType])).toEqual([
			[undefined, "entity"],
			["name", "string"],
			["description", "string"],
			["text", "string"],
		]);
	});

	it("exposes raw entered text from phrase and relation structure blocks", () => {
		for (const blockId of ["phrase-block", "relation-block"]) {
			expect(commandCatalog().options).toContainEqual(
				expect.objectContaining({
					blockId: toID("command-block", blockId),
					projection: "text",
					valueType: "string",
				}),
			);
		}
	});

	it("exposes canonical names and entered text for direction blocks", () => {
		const directionOptions = commandCatalog().options.filter(
			(option) => option.blockId.id === "direction-block",
		);

		expect(directionOptions.map((option) => [option.projection, option.valueType])).toEqual([
			[undefined, "direction"],
			["name", "string"],
			["text", "string"],
		]);
	});

	it("only exposes entered text for the block whose fallback is running", () => {
		const targetOptions = commandCatalog(true).options.filter(
			(option) => option.blockId.id === "target-block",
		);

		expect(targetOptions).toHaveLength(1);
		expect(targetOptions[0]).toMatchObject({projection: "text", valueType: "string"});
	});

	it("never offers entity or numeric values to a boolean field", () => {
		const compatible = compatibleVariableOptions(commandCatalog(), {
			type: "toggle",
		});

		expect(compatible.map((option) => option.label)).toEqual(["enabled"]);
		expect(compatible.every((option) => option.valueType === "boolean")).toBe(true);
	});

	it("respects the entity type accepted by an entity picker", () => {
		const compatible = compatibleVariableOptions(commandCatalog(), {
			type: "entity-picker",
			entityType: "room",
		});

		expect(compatible).toEqual([]);
	});
});
