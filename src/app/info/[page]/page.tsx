import Link from "next/link";
import {notFound} from "next/navigation";

import "../info.scss";

const pages = {
	about: {
		title: "About Mothmark",
		body: "The full story of the site and the people building it will live here.",
	},
	faq: {
		title: "Frequently asked questions",
		body: "Answers about making, publishing, and playing worlds are being assembled.",
	},
	blog: {
		title: "Mothmark notes",
		body: "Development notes, editor updates, and featured worlds will appear here.",
	},
	terms: {
		title: "Terms of service",
		body: "Mothmark's terms of service are being prepared before public launch.",
	},
	contact: {
		title: "Contact us",
		body: "A public contact address and support form will be available here soon.",
	},
	bluesky: {
		title: "Mothmark on Bluesky",
		body: "The official Mothmark social account has not opened yet.",
	},
	mastodon: {
		title: "Mothmark on Mastodon",
		body: "The official Mothmark social account has not opened yet.",
	},
	instagram: {
		title: "Mothmark on Instagram",
		body: "The official Mothmark social account has not opened yet.",
	},
	newsletter: {
		title: "Mothmark newsletter",
		body: "Newsletter sign-ups will open when the first issue is ready.",
	},
} as const;

export function generateStaticParams() {
	return Object.keys(pages).map((page) => ({page}));
}

export default async function InfoPage({params}: {params: Promise<{page: string}>}) {
	const page = pages[(await params).page as keyof typeof pages];
	if (!page) notFound();

	return (
		<main className="infoPage">
			<article>
				<p>In progress</p>
				<h1>{page.title}</h1>
				<p>{page.body}</p>
				<Link href="/">Return home</Link>
			</article>
		</main>
	);
}
