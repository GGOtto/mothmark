"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useCallback, useEffect, useState} from "react";

import {formatAdminDate, mutateAdminJson, readAdminJson} from "../../../adminClient";
import type {AdminPublication} from "../../../adminTypes";
import {usePopup} from "@/components/popup/Popup";

type DiscoverySettings = Pick<
	AdminPublication,
	"homepagePosition" | "isOfficial" | "listedOnHomepage" | "visibility"
>;

const discoverySettingsFor = (publication: AdminPublication): DiscoverySettings => ({
	homepagePosition: publication.homepagePosition,
	isOfficial: publication.isOfficial,
	listedOnHomepage: publication.listedOnHomepage,
	visibility: publication.visibility,
});

export default function AdminPublicationDetailPage() {
	const id = String(useParams<{id: string}>().id);
	const popup = usePopup();
	const [publication, setPublication] = useState<AdminPublication | null>(null);
	const [settings, setSettings] = useState<DiscoverySettings | null>(null);
	const [reason, setReason] = useState("");
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [working, setWorking] = useState(false);

	const acceptPublication = useCallback((next: AdminPublication) => {
		setPublication(next);
		setSettings(discoverySettingsFor(next));
	}, []);

	useEffect(() => {
		readAdminJson<{data: AdminPublication}>(`/api/admin/publications/${id}`)
			.then((result) => acceptPublication(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "The publication could not be loaded."),
			);
	}, [acceptPublication, id]);

	const setSuspension = async (suspended: boolean) => {
		const suspensionReason = suspended
			? (
					await popup.prompt({
						title: "Suspend this publication?",
						message: "Suspension immediately blocks all play.",
						label: "Administrative reason",
						submitLabel: "Suspend publication",
						required: true,
					})
				)?.trim()
			: undefined;
		if (suspended && !suspensionReason) return;
		setWorking(true);
		setError("");
		setNotice("");
		try {
			const result = await mutateAdminJson<{data: AdminPublication}>(
				`/api/admin/publications/${id}`,
				"PUT",
				suspended ? {status: "suspended", reason: suspensionReason} : {status: "unpublished"},
			);
			acceptPublication(result.data);
			setNotice(suspended ? "Publication suspended." : "Suspension lifted.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The publication could not be updated.");
		} finally {
			setWorking(false);
		}
	};

	const saveDiscovery = async () => {
		if (!publication || !settings || !reason.trim()) return;
		if (settings.isOfficial !== publication.isOfficial) {
			const confirmed = await popup.confirm({
				title: settings.isOfficial ? "Make this an official world?" : "Return this to Community?",
				message: settings.isOfficial
					? "Official status is a deliberate editorial endorsement."
					: "Removing Official also removes the world from the home page.",
				confirmLabel: settings.isOfficial ? "Make official" : "Remove official status",
			});
			if (!confirmed) return;
		}
		setWorking(true);
		setError("");
		setNotice("");
		try {
			const result = await mutateAdminJson<{data: AdminPublication}>(
				`/api/admin/publications/${id}`,
				"PUT",
				{action: "update_curation", ...settings, reason: reason.trim()},
			);
			acceptPublication(result.data);
			setReason("");
			setNotice("Discovery settings saved.");
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "The publication could not be updated.");
		} finally {
			setWorking(false);
		}
	};

	const discoveryChanged = Boolean(
		publication &&
		settings &&
		(publication.visibility !== settings.visibility ||
			publication.isOfficial !== settings.isOfficial ||
			publication.listedOnHomepage !== settings.listedOnHomepage ||
			publication.homepagePosition !== settings.homepagePosition),
	);
	const homepagePositionValid =
		!settings?.listedOnHomepage ||
		(settings.visibility === "listed" &&
			settings.isOfficial &&
			settings.homepagePosition !== null &&
			Number.isInteger(settings.homepagePosition) &&
			settings.homepagePosition > 0);

	return (
		<main className="adminPage">
			<Link className="adminBackLink" href="/admin/publications">
				← Publications
			</Link>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{notice ? (
				<p className="adminNotice" role="status">
					{notice}
				</p>
			) : null}
			{!publication && !error ? <p role="status">Loading publication…</p> : null}
			{publication && settings ? (
				<>
					<header className="adminPageHeader">
						<div>
							<h1>{publication.title}</h1>
							<p>/play/{publication.slug}</p>
						</div>
						<span className={`adminStatus adminStatus-${publication.status}`}>{publication.status}</span>
					</header>

					<section className="adminSection">
						<div className="adminSectionHeading">
							<h2>Publication metadata</h2>
							<Link href={`/admin/playthroughs?publicationId=${publication.id}`}>View playthroughs</Link>
						</div>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Public URL</dt>
								<dd>
									<a href={`/play/${publication.slug}`}>/play/{publication.slug}</a>
								</dd>
							</div>
							<div>
								<dt>Release</dt>
								<dd>{publication.release.number}</dd>
							</div>
							<div>
								<dt>Published</dt>
								<dd>{formatAdminDate(publication.release.publishedAt)}</dd>
							</div>
							<div>
								<dt>Owner</dt>
								<dd>
									<Link href={`/admin/users/${publication.ownerUserId}`}>{publication.ownerUsername}</Link>
								</dd>
							</div>
							<div>
								<dt>Source world</dt>
								<dd>
									<Link href={`/admin/worlds/${publication.worldId}`}>{publication.worldId}</Link>
								</dd>
							</div>
							<div>
								<dt>Editorial status</dt>
								<dd>{publication.isOfficial ? "Official" : "Community"}</dd>
							</div>
						</dl>
						<h3 className="adminSubheading">Public summary</h3>
						<p>{publication.summary}</p>
					</section>

					<section className="adminSection">
						<h2>Discovery controls</h2>
						<p>Control where this publication appears. Direct links remain playable while published.</p>
						<div className="adminDiscoveryControls">
							<label className="adminCheckboxControl">
								<input
									type="checkbox"
									checked={settings.visibility === "listed"}
									onChange={(event) =>
										setSettings({
											...settings,
											visibility: event.target.checked ? "listed" : "unlisted",
											listedOnHomepage: event.target.checked ? settings.listedOnHomepage : false,
											homepagePosition: event.target.checked ? settings.homepagePosition : null,
										})
									}
								/>
								<span>
									<strong>Published worlds page</strong>
									<small>Include this world in the complete public catalog and author profile.</small>
								</span>
							</label>
							<label className="adminCheckboxControl">
								<input
									type="checkbox"
									checked={settings.isOfficial}
									onChange={(event) =>
										setSettings({
											...settings,
											isOfficial: event.target.checked,
											listedOnHomepage: event.target.checked ? settings.listedOnHomepage : false,
											homepagePosition: event.target.checked ? settings.homepagePosition : null,
										})
									}
								/>
								<span>
									<strong>Official world</strong>
									<small>Mark this as deliberately reviewed and endorsed by Mothmark.</small>
								</span>
							</label>
							<label className="adminCheckboxControl">
								<input
									type="checkbox"
									checked={settings.listedOnHomepage}
									disabled={!settings.isOfficial}
									onChange={(event) =>
										setSettings({
											...settings,
											listedOnHomepage: event.target.checked,
											visibility: event.target.checked ? "listed" : settings.visibility,
											homepagePosition: event.target.checked ? (settings.homepagePosition ?? 1) : null,
										})
									}
								/>
								<span>
									<strong>Home page</strong>
									<small>Feature this official world in the home page carousel.</small>
								</span>
							</label>
							<label className="adminHomepagePosition">
								<span>Home page position</span>
								<input
									type="number"
									min="1"
									max="10000"
									value={settings.homepagePosition ?? ""}
									disabled={!settings.listedOnHomepage}
									onChange={(event) =>
										setSettings({
											...settings,
											homepagePosition: event.target.value ? Number(event.target.value) : null,
										})
									}
								/>
								<small>Position 1 is the first and initially prominent game.</small>
							</label>
						</div>
						<label htmlFor="curation-reason">Administrative reason</label>
						<textarea
							id="curation-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Required for audited discovery changes"
						/>
						<button
							type="button"
							disabled={working || !discoveryChanged || !homepagePositionValid || !reason.trim()}
							onClick={() => void saveDiscovery()}
						>
							{working ? "Saving…" : "Save discovery settings"}
						</button>
					</section>

					<section className="adminSection">
						<h2>Publication lifecycle</h2>
						<p>
							Suspension immediately blocks all play. Lifting it leaves the world unpublished so its owner
							can decide when to republish.
						</p>
						{publication.status === "suspended" ? (
							<button type="button" disabled={working} onClick={() => void setSuspension(false)}>
								{working ? "Working…" : "Lift suspension"}
							</button>
						) : (
							<button
								className="adminDangerButton"
								type="button"
								disabled={working}
								onClick={() => void setSuspension(true)}
							>
								{working ? "Working…" : "Suspend publication"}
							</button>
						)}
					</section>
				</>
			) : null}
		</main>
	);
}
