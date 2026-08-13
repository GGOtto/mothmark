import {readdir} from "node:fs/promises";
import path from "node:path";
import type {Metadata} from "next";
import Image from "next/image";
import Link from "next/link";
import "./page.scss";

export const metadata: Metadata = {
	title: "Item icon gallery — Mothmark",
};

const ICON_SIZES = [24, 32, 48, 64, 128] as const;
const ICON_THEMES = ["light", "dark"] as const;

function iconLabel(filename: string) {
	return filename
		.replace(/\.png$/, "")
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

async function getIconFilenames() {
	const iconDirectory = path.join(process.cwd(), "public", "item-icons", "light", "64");
	const entries = await readdir(iconDirectory, {withFileTypes: true});

	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".png"))
		.map((entry) => entry.name)
		.sort((left, right) => left.localeCompare(right));
}

export default async function ItemIconGalleryPage() {
	const iconFilenames = await getIconFilenames();
	const imageCount = iconFilenames.length * ICON_SIZES.length * ICON_THEMES.length;

	return (
		<main className="itemIconGallery">
			<header className="itemIconGallery__header">
				<div className="itemIconGallery__heading">
					<Link className="itemIconGallery__back" href="/test">
						Back to test pages
					</Link>
					<h1>Item icons</h1>
					<p>Compare every category at its exported sizes on the light and dark editor surfaces.</p>
				</div>
				<p className="itemIconGallery__count">
					{iconFilenames.length} categories · {imageCount} PNG files
				</p>
			</header>

			<div className="itemIconGallery__body">
				<section className="itemIconGallery__grid" aria-label="Item icon categories">
					{iconFilenames.map((filename) => {
						const category = filename.replace(/\.png$/, "");
						const label = iconLabel(filename);

						return (
							<article className="itemIconGallery__category" data-category={category} key={filename}>
								<header className="itemIconGallery__categoryHeader">
									<h2>{label}</h2>
									<code>{filename}</code>
								</header>

								<div className="itemIconGallery__themes">
									{ICON_THEMES.map((theme) => (
										<section
											aria-label={`${label}, ${theme} editor theme`}
											className={`itemIconGallery__theme itemIconGallery__theme--${theme}`}
											key={theme}
										>
											<h3>{theme === "light" ? "Light editor" : "Dark editor"}</h3>
											<div className="itemIconGallery__sizes">
												{ICON_SIZES.map((size) => (
													<figure key={size}>
														<span className="itemIconGallery__imageFrame">
															<Image
																alt={`${label} at ${size} pixels for the ${theme} editor theme`}
																height={size}
																src={`/item-icons/${theme}/${size}/${filename}`}
																unoptimized
																width={size}
															/>
														</span>
														<figcaption>{size}px</figcaption>
													</figure>
												))}
											</div>
										</section>
									))}
								</div>
							</article>
						);
					})}
				</section>
			</div>
		</main>
	);
}
