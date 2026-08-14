"use client";

import {HugeiconsIcon} from "@hugeicons/react";
import {useState} from "react";
import {OFFICIAL_ITEM_ICON_NAMES, type ItemIconCategory} from "@/itemIcons";
import {
	FOLDED_CATEGORY_VOCABULARY,
	HUGE_ICON_ALTERNATIVES,
	HUGE_ICON_MATCHES,
	HUGE_ICON_MISSING_MARK,
	HUGE_ICON_SUGGESTIONS,
} from "./hugeIconCatalog";

export type ItemIconSpecEntry = {
	category: ItemIconCategory;
	index: number;
	label: string;
	mainCategory: string;
	terms: readonly string[];
};

const ICON_SIZES = [64, 128] as const;

const CROSSED_OUT_OPTION = {
	icon: HUGE_ICON_MISSING_MARK,
	iconName: "Crossed-out fallback",
	rationale: "No library icon selected. Choose a different library option.",
} as const;

function iconChoicesFor(category: ItemIconCategory) {
	const match = HUGE_ICON_MATCHES[category];
	const candidates = match
		? [
				{icon: match.icon, iconName: match.iconName, rationale: match.note},
				...(HUGE_ICON_ALTERNATIVES[category] ?? []),
			]
		: [...(HUGE_ICON_SUGGESTIONS[category] ?? []), CROSSED_OUT_OPTION];
	const deduplicated = candidates.filter(
		(choice, index) =>
			candidates.findIndex((candidate) => candidate.iconName === choice.iconName) === index,
	);
	const officialName = OFFICIAL_ITEM_ICON_NAMES[category];
	const officialIndex = deduplicated.findIndex((choice) => choice.iconName === officialName);

	return officialIndex < 0
		? deduplicated
		: [deduplicated[officialIndex], ...deduplicated.filter((_, index) => index !== officialIndex)];
}

function HugeIconCard({
	choiceIndex,
	entry,
	onChoiceChange,
}: {
	choiceIndex: number;
	entry: ItemIconSpecEntry;
	onChoiceChange: (index: number) => void;
}) {
	const [showTerms, setShowTerms] = useState(false);
	const iconChoices = iconChoicesFor(entry.category);
	const selectedChoice = iconChoices[choiceIndex] ?? CROSSED_OUT_OPTION;
	const isCallToAction = selectedChoice.iconName === CROSSED_OUT_OPTION.iconName;
	const foldedCategories = FOLDED_CATEGORY_VOCABULARY[entry.category] ?? [];
	const status = isCallToAction
		? "Needs a new icon"
		: choiceIndex === 0
			? "Official"
			: "Alternative";

	function moveChoice(direction: -1 | 1) {
		onChoiceChange((choiceIndex + direction + iconChoices.length) % iconChoices.length);
	}

	return (
		<article
			className={`itemIconGallery__category${isCallToAction ? " itemIconGallery__category--missing" : ""}`}
			data-category={entry.category}
			data-library-status={
				isCallToAction ? "call-to-action" : choiceIndex === 0 ? "official" : "alternative"
			}
		>
			<header className="itemIconGallery__categoryHeader">
				<div className="itemIconGallery__categoryIdentity">
					<div className="itemIconGallery__categoryTitle">
						<span className="itemIconGallery__index">{entry.index}</span>
						<h2>{entry.label}</h2>
					</div>
					<p
						className={`itemIconGallery__libraryStatus itemIconGallery__libraryStatus--${isCallToAction ? "missing" : choiceIndex === 0 ? "exact" : "close"}`}
					>
						{status}
					</p>
					<code>{selectedChoice.iconName}</code>
				</div>
				<button
					aria-expanded={showTerms}
					className="itemIconGallery__tagButton"
					onClick={() => setShowTerms((visible) => !visible)}
					type="button"
				>
					{showTerms ? "Hide tags" : "Show tags"}
				</button>
			</header>

			<div className="itemIconGallery__matchNote">
				<p>{entry.mainCategory}</p>
				<div className="itemIconGallery__suggestionControls">
					<button
						aria-label={`Previous icon choice for ${entry.label}`}
						onClick={() => moveChoice(-1)}
						type="button"
					>
						Previous
					</button>
					<span>
						Choice {choiceIndex + 1} of {iconChoices.length}
					</span>
					<button
						aria-label={`Next icon choice for ${entry.label}`}
						onClick={() => moveChoice(1)}
						type="button"
					>
						Next
					</button>
				</div>
				<p>{selectedChoice.rationale}</p>
				{foldedCategories.length > 0 ? (
					<p>
						<strong>Folded vocabulary:</strong> {foldedCategories.join(", ")}
					</p>
				) : null}
			</div>

			{showTerms ? (
				<section className="itemIconGallery__terms" aria-label={`${entry.label} matching vocabulary`}>
					<h3>Names, aliases, and tags</h3>
					<ul>
						{entry.terms.map((term) => (
							<li key={term}>{term}</li>
						))}
					</ul>
				</section>
			) : null}

			<div className="itemIconGallery__themes">
				{(["light", "dark"] as const).map((theme) => (
					<section
						aria-label={`${entry.label}, ${theme} editor theme`}
						className={`itemIconGallery__theme itemIconGallery__theme--${theme}`}
						key={theme}
					>
						<h3>{theme === "light" ? "Light" : "Dark"}</h3>
						<div className="itemIconGallery__sizes">
							{ICON_SIZES.map((size) => (
								<figure className={`itemIconGallery__size itemIconGallery__size--${size}`} key={size}>
									<div className="itemIconGallery__imageFrame">
										<HugeiconsIcon
											aria-label={`${entry.label} using ${selectedChoice.iconName}`}
											icon={selectedChoice.icon}
											size={size}
											strokeWidth={0.75}
										/>
									</div>
									<figcaption>{size}px</figcaption>
								</figure>
							))}
						</div>
					</section>
				))}
			</div>
		</article>
	);
}

export function HugeIconGallery({entries}: {entries: readonly ItemIconSpecEntry[]}) {
	const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");
	const [iconSelections, setIconSelections] = useState<Record<string, number>>({});
	const foldedCategoryCount = Object.values(FOLDED_CATEGORY_VOCABULARY).reduce(
		(total, categories) => total + categories.length,
		0,
	);
	const incompleteCategories = entries.filter(
		(entry) =>
			iconChoicesFor(entry.category).filter(
				(choice) => choice.iconName !== CROSSED_OUT_OPTION.iconName,
			).length < 3,
	);
	const missingOfficialChoices = entries.filter(
		(entry) =>
			iconChoicesFor(entry.category)[0]?.iconName !== OFFICIAL_ITEM_ICON_NAMES[entry.category],
	);
	const officialIconNames = entries.map((entry) => OFFICIAL_ITEM_ICON_NAMES[entry.category]);
	const duplicateOfficialIconNames = officialIconNames.filter(
		(iconName, index) => iconName && officialIconNames.indexOf(iconName) !== index,
	);

	if (
		incompleteCategories.length > 0 ||
		missingOfficialChoices.length > 0 ||
		duplicateOfficialIconNames.length > 0
	) {
		throw new Error(
			`Every item icon needs an official selection and at least three actual choices. Incomplete: ${[
				...new Set([...incompleteCategories, ...missingOfficialChoices].map((entry) => entry.category)),
			].join(", ")}. Duplicate official icons: ${[...new Set(duplicateOfficialIconNames)].join(", ")}`,
		);
	}

	async function copyAllChoices() {
		const lines = entries.map((entry) => {
			const selectedIndex = iconSelections[entry.category] ?? 0;
			const selected = iconChoicesFor(entry.category)[selectedIndex] ?? CROSSED_OUT_OPTION;
			const kind =
				selected.iconName === CROSSED_OUT_OPTION.iconName
					? "No icon"
					: selectedIndex === 0
						? "Official"
						: "Alternative";
			return `${entry.index}. ${entry.category}: ${selected.iconName} [${kind}]`;
		});
		const text = [
			"Item icon choices (100)",
			"Edit any choice below and paste the list back into Codex.",
			"",
			...lines,
		].join("\n");

		try {
			await navigator.clipboard.writeText(text);
			setCopyStatus("copied");
		} catch {
			setCopyStatus("error");
		}
	}

	return (
		<>
			<div className="itemIconGallery__toolbar">
				<p className="itemIconGallery__count">
					{entries.length} official marks · {foldedCategoryCount} folded categories · 3+ choices each
				</p>
				<div className="itemIconGallery__copyControl">
					<button className="itemIconGallery__copyButton" onClick={copyAllChoices} type="button">
						Copy all choices
					</button>
					<span aria-live="polite">
						{copyStatus === "copied" ? "Copied 100 choices" : copyStatus === "error" ? "Copy failed" : ""}
					</span>
				</div>
			</div>
			<div className="itemIconGallery__grid">
				{entries.map((entry) => (
					<HugeIconCard
						choiceIndex={iconSelections[entry.category] ?? 0}
						entry={entry}
						key={entry.category}
						onChoiceChange={(index) =>
							setIconSelections((current) => ({...current, [entry.category]: index}))
						}
					/>
				))}
			</div>
		</>
	);
}
