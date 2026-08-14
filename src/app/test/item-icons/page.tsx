import type {Metadata} from "next";
import Link from "next/link";
import {ITEM_ICON_CATALOG} from "@/itemIcons";
import {HugeIconGallery, type ItemIconSpecEntry} from "./HugeIconGallery";
import "./page.scss";

export const metadata: Metadata = {
	title: "Item icon gallery — Mothmark",
};

function categoryLabel(category: string) {
	const label = category.replaceAll("-", " ");
	return label.charAt(0).toUpperCase() + label.slice(1);
}

function getCatalogEntries(): ItemIconSpecEntry[] {
	return ITEM_ICON_CATALOG.map((entry, index) => ({
		category: entry.id,
		index: index + 1,
		label: categoryLabel(entry.id),
		mainCategory: entry.parents.map(categoryLabel).join(" · ") || "Universal",
		terms: [...entry.identityTerms, ...entry.categoryTerms, ...(entry.descriptorTerms ?? [])],
	}));
}

export default async function ItemIconGalleryPage() {
	const entries = getCatalogEntries();

	return (
		<main className="itemIconGallery">
			<header className="itemIconGallery__header">
				<div className="itemIconGallery__heading">
					<Link className="itemIconGallery__back" href="/test">
						Back to test pages
					</Link>
					<h1>Hugeicons item catalog</h1>
					<p>
						Every category in the 100-mark specification, rendered from the free Stroke Rounded set at
						64px and 128px. The Nature leaf sets the reduced line-weight benchmark. Every item has at
						least three actual library choices. Unavailable and duplicate marks have been folded into
						surviving vocabulary, and the freed positions contain new proposed categories.
					</p>
				</div>
			</header>

			<div className="itemIconGallery__body">
				<HugeIconGallery entries={entries} />
			</div>
		</main>
	);
}
