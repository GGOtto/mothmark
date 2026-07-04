import {Toolbar} from "@/components/editor/ToolBar";
import {LeftSideBar} from "../components/editor/LeftSideBar";
import {RightSideBar} from "../components/editor/RightSideBar";
import {Map} from "../components/map/Map";

export default function EditorPage() {
	return (
		<main className="flex min-h-0 w-full flex-1 overflow-hidden">
			<LeftSideBar />

			<section className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<Toolbar />

				<div className="min-h-0 flex-1 overflow-hidden">
					<Map />
				</div>
			</section>

			<RightSideBar />
		</main>
	);
}
