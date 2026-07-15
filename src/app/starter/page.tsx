"use client";

import {useMemo, useState} from "react";
import {WorldSchema} from "../../schemas/worldSchema";
import {createDefaultFieldObject} from "../../utils/createDefaultFieldObject";
import "./page.scss";

export default function StarterWorldPage() {
	const [hasCopied, setHasCopied] = useState(false);
	const starterWorldJson = useMemo(
		() => JSON.stringify(createDefaultFieldObject(WorldSchema, {populateArrays: true}), null, 2),
		[],
	);

	async function copyJson() {
		await navigator.clipboard.writeText(starterWorldJson);
		setHasCopied(true);

		window.setTimeout(() => setHasCopied(false), 1200);
	}

	return (
		<main className="starterWorldPage">
			<div className="starterWorldPageInner">
				<header className="starterWorldHeader">
					<h1>Starter World</h1>
					<p>Copy this generated JSON and fill it out to create a new Mothmark world.</p>
				</header>

				<section className="starterWorldJsonPanel">
					<div className="starterWorldJsonPanelHeader">
						<h2>Starter world JSON</h2>
						<button type="button" onClick={copyJson}>
							{hasCopied ? "Copied!" : "Copy"}
						</button>
					</div>

					<pre>
						<code>{starterWorldJson}</code>
					</pre>
				</section>
			</div>
		</main>
	);
}
