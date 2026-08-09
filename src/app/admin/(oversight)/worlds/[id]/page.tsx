"use client";

import Link from "next/link";
import {useParams} from "next/navigation";
import {useEffect, useState} from "react";

import {formatAdminDate, formatBytes, readAdminJson} from "../../../adminClient";
import type {AdminWorld} from "../../../adminTypes";

type AdminWorldDetail = AdminWorld & {world: unknown};

export default function AdminWorldDetailPage() {
	const {id} = useParams<{id: string}>();
	const [world, setWorld] = useState<AdminWorldDetail | null>(null);
	const [error, setError] = useState("");
	useEffect(() => {
		readAdminJson<{data: AdminWorldDetail}>(`/api/admin/worlds/${id}`)
			.then((result) => setWorld(result.data))
			.catch((caught: unknown) =>
				setError(caught instanceof Error ? caught.message : "World could not be loaded."),
			);
	}, [id]);
	return (
		<main className="adminPage">
			<Link className="adminBackLink" href="/admin/worlds">
				← Worlds
			</Link>
			{error ? (
				<p className="adminError" role="alert">
					{error}
				</p>
			) : null}
			{!world && !error ? <p role="status">Loading world…</p> : null}
			{world ? (
				<>
					<header className="adminPageHeader">
						<div>
							<h1>{world.name}</h1>
							<p>Read-only world inspection</p>
						</div>
						<span className={`adminStatus adminStatus-${world.lifecycle}`}>{world.lifecycle}</span>
					</header>
					<section className="adminSection">
						<h2>World metadata</h2>
						<dl className="adminDefinitionGrid">
							<div>
								<dt>Owner</dt>
								<dd>
									<Link href={`/admin/users/${world.owner.id}`}>
										{world.owner.displayName || world.owner.id}
									</Link>
								</dd>
							</div>
							<div>
								<dt>Revision</dt>
								<dd>{world.revision}</dd>
							</div>
							<div>
								<dt>Schema version</dt>
								<dd>{world.schemaVersion}</dd>
							</div>
							<div>
								<dt>Document size</dt>
								<dd>{formatBytes(world.worldSizeBytes)}</dd>
							</div>
							<div>
								<dt>Created</dt>
								<dd>{formatAdminDate(world.createdAt)}</dd>
							</div>
							<div>
								<dt>Updated</dt>
								<dd>{formatAdminDate(world.updatedAt)}</dd>
							</div>
							<div>
								<dt>Private editor slug</dt>
								<dd>{world.editorSlug || "—"}</dd>
							</div>
							<div>
								<dt>Deleted</dt>
								<dd>{formatAdminDate(world.deletedAt)}</dd>
							</div>
						</dl>
					</section>
					<section className="adminSection">
						<div className="adminSectionHeading">
							<h2>World document</h2>
							<span>Inspection only</span>
						</div>
						<pre className="adminJson">
							<code>{JSON.stringify(world.world, null, 2)}</code>
						</pre>
					</section>
				</>
			) : null}
		</main>
	);
}
