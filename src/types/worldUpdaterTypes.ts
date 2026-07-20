import type {Producer} from "immer";
import type {World} from "@/schemas/world/worldSchema";

export type WorldUpdate = World | Producer<World>;
export type UpdateWorld = (update: WorldUpdate) => void;
