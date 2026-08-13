import {produce} from "immer";
import {world as initialWorld} from "@/data/worlds/initialWorld";
import {createDefaultFieldObject} from "@/utils/createDefaultFieldObject";
import {toID} from "@/utils/idUtils";
import {EffectGroupSchema} from "@/schemas/world/effectSchema";
import {findLogicUsages} from "./logicLibraryUsage";

describe("findLogicUsages", () => {
	it("finds reusable effect references without counting the definition itself", () => {
		const world = produce(initialWorld, (draft) => {
			const effect = createDefaultFieldObject(EffectGroupSchema);
			effect.id = toID("effect", "shared-effect");
			effect.name = "Shared effect";
			draft.effects = [effect];
			draft.commands[0].behavior.always?.effects.push({
				type: "effect-ref",
				effectId: effect.id,
			});
		});

		expect(findLogicUsages(world, "effect", "shared-effect")).toEqual([
			expect.objectContaining({kind: "command", id: "help"}),
		]);
	});
});
