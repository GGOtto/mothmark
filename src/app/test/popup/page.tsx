"use client";

import {useState} from "react";
import {usePopup} from "../../../components/popup/Popup";
import "./page.scss";

export default function PopupTestPage() {
	const popup = usePopup();
	const [result, setResult] = useState("Nothing opened yet.");

	async function openAlert() {
		await popup.alert({
			title: "World saved",
			message: "Your latest changes are safely stored.",
		});
		setResult("Alert closed.");
	}

	async function openConfirm() {
		const confirmed = await popup.confirm({
			title: "Delete this room?",
			message: "This action cannot be undone.",
			confirmLabel: "Delete room",
			danger: true,
		});
		setResult(confirmed ? "Room deletion confirmed." : "Room deletion cancelled.");
	}

	async function openPrompt() {
		const name = await popup.prompt({
			title: "Name this room",
			message: "Choose a short name that will be easy to recognize on the map.",
			label: "Room name",
			placeholder: "The Lantern Room",
			required: true,
			validate: (value) => (value.length < 3 ? "Use at least three characters." : undefined),
		});
		setResult(name ? `Room named “${name}”.` : "Room naming cancelled.");
	}

	return (
		<main className="popupTestPage">
			<section className="popupTestCard">
				<p className="popupTestEyebrow">Component test</p>
				<h1>Popups</h1>
				<p className="popupTestDescription">
					Open each popup to check its content, controls, keyboard behavior, and theme styling.
				</p>

				<div className="popupTestActions">
					<button type="button" onClick={openAlert}>
						Open alert
					</button>
					<button type="button" onClick={openConfirm}>
						Open confirmation
					</button>
					<button type="button" onClick={openPrompt}>
						Open prompt
					</button>
				</div>

				<output className="popupTestResult" aria-live="polite">
					<span>Last result</span>
					{result}
				</output>
			</section>
		</main>
	);
}
