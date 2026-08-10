"use client";

import {useState} from "react";
import Link from "next/link";

import {FeedbackDialog} from "@/components/header/FeedbackDialog";

export function HomeFooter() {
	const [contactOpen, setContactOpen] = useState(false);

	return (
		<>
			<footer className="homeFooter">
				<strong>Mothmark</strong>
				<nav aria-label="Footer navigation">
					<Link href="/play">Browse worlds</Link>
					<Link href="/account">Account</Link>
					<a href="#about-mothmark">About</a>
					<button type="button" onClick={() => setContactOpen(true)}>
						Contact Us
					</button>
				</nav>
			</footer>
			{contactOpen ? <FeedbackDialog onClose={() => setContactOpen(false)} /> : null}
		</>
	);
}
