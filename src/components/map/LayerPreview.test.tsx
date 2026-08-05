import {fireEvent, render, screen} from "@testing-library/react";
import {world} from "@/data/worlds/exampleWorld";
import {idValue} from "@/utils/idUtils";
import {getLayer} from "./utils/layerUtils";
import {LayerPreview} from "./LayerPreview";

describe("LayerPreview", () => {
	const layer = getLayer(world, 0);

	it("renders a read-only layer scene and delegates clicks to the preview", () => {
		const onClick = jest.fn();
		const {container} = render(
			<LayerPreview world={world} layer={layer} isFramed={false} mode="static" onClick={onClick} />,
		);

		expect(container.querySelectorAll(".roomCardPreview")).toHaveLength(layer.rooms.length);
		expect(container.querySelector(".node")).not.toBeInTheDocument();
		expect(container.querySelector(".connectionMidpointGlyphFaceLayer")).toBeInTheDocument();
		expect(container.querySelector(".connectionClickTarget")).not.toBeInTheDocument();
		expect(container.querySelector(".connectionMidpointGlyphControl")).not.toBeInTheDocument();

		fireEvent.click(screen.getByRole("button", {name: `Open ${layer.name}`}));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("preserves room and connection selection styling", () => {
		const roomId = idValue(layer.rooms[0]);
		const connectionId = idValue(
			world.connections.find((connection) => idValue(connection.id) === "entrance-guardroom")!.id,
		);
		const {container, rerender} = render(
			<LayerPreview world={world} layer={layer} isFramed={false} mode="static" selectedId={roomId} />,
		);

		expect(container.querySelector(".roomCardSelected")).toHaveAttribute("title");

		rerender(
			<LayerPreview
				world={world}
				layer={layer}
				isFramed={false}
				mode="static"
				selectedId={connectionId}
				isConnectionSelected
			/>,
		);

		expect(container.querySelector(".connectionSelected")).toBeInTheDocument();
	});

	it("uses the layer's saved viewport when framing is disabled", () => {
		const savedLayer = {...layer, viewport: {x: 17, y: 29, zoom: 1.25}};
		const {container} = render(
			<LayerPreview world={world} layer={savedLayer} isFramed={false} mode="static" />,
		);

		expect(container.querySelector(".layerPreviewViewport")).toHaveStyle({
			transform: "translate(17px, 29px) scale(1.25)",
		});
	});

	it("accepts caller-controlled dimensions", () => {
		const {container} = render(
			<LayerPreview
				world={world}
				layer={layer}
				isFramed
				mode="static"
				style={{width: 240, height: 120}}
			/>,
		);

		expect(container.querySelector("[data-layer-preview]")).toHaveStyle({
			width: "240px",
			height: "120px",
		});
	});
});
