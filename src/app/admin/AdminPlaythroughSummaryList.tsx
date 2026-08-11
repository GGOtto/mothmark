import Link from "next/link";

import {formatAdminDate} from "./adminClient";
import type {AdminPlaythrough} from "./adminTypes";

export function AdminPlaythroughSummaryList({
	playthroughs,
	heading = "Playthroughs",
}: {
	playthroughs: AdminPlaythrough[];
	heading?: string;
}) {
	return (
		<section className="adminSection">
			<h2>{heading}</h2>
			{playthroughs.length ? (
				<div className="adminTableFrame">
					<table>
						<thead>
							<tr>
								<th scope="col">Playthrough</th>
								<th scope="col">State</th>
								<th scope="col">Release</th>
								<th scope="col">Last activity</th>
								<th scope="col">Restart lineage</th>
							</tr>
						</thead>
						<tbody>
							{playthroughs.map((playthrough) => (
								<tr key={playthrough.id}>
									<td>
										<Link href={`/admin/playthroughs/${playthrough.id}`}>{playthrough.publicationTitle}</Link>
									</td>
									<td>{playthrough.status}</td>
									<td>{playthrough.releaseNumber}</td>
									<td>{formatAdminDate(playthrough.lastActivityAt)}</td>
									<td>
										{playthrough.restartedFromPlaythroughId ? (
											<Link href={`/admin/playthroughs/${playthrough.restartedFromPlaythroughId}`}>
												Previous run
											</Link>
										) : null}
										{playthrough.restartedFromPlaythroughId && playthrough.restartedToPlaythroughId
											? " · "
											: null}
										{playthrough.restartedToPlaythroughId ? (
											<Link href={`/admin/playthroughs/${playthrough.restartedToPlaythroughId}`}>
												Next run
											</Link>
										) : null}
										{!playthrough.restartedFromPlaythroughId && !playthrough.restartedToPlaythroughId
											? "Original run"
											: null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>No playthroughs recorded.</p>
			)}
		</section>
	);
}
