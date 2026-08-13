import {Camera, Cloud, MessageCircle} from "lucide-react";
import Link from "next/link";

import {MothmarkLogo} from "../brand/MothmarkLogo";

import "./SiteFooter.scss";

const footerGroups = [
	{
		title: "Explore",
		ariaLabel: "Footer product links",
		links: [
			{label: "Games", href: "/play"},
			{label: "Create", href: "/worlds"},
		],
	},
	{
		title: "About",
		ariaLabel: "Company information",
		links: [
			{label: "About the site", href: "/info/about"},
			{label: "FAQ", href: "/info/faq"},
			{label: "Blog", href: "/info/blog"},
		],
	},
	{
		title: "Site info",
		ariaLabel: "Legal and contact links",
		links: [
			{label: "Terms of service", href: "/info/terms"},
			{label: "Privacy", href: "/privacy"},
			{label: "Contact us", href: "/info/contact"},
		],
	},
];

const socialLinks = [
	{label: "Bluesky", href: "/info/bluesky", icon: Cloud},
	{label: "Mastodon", href: "/info/mastodon", icon: MessageCircle},
	{label: "Instagram", href: "/info/instagram", icon: Camera},
];

export function SiteFooter() {
	return (
		<footer className="siteFooter" id="site-footer">
			<div className="siteFooter__lead">
				<div className="siteFooter__identity">
					<Link href="/" aria-label="Mothmark footer home">
						<MothmarkLogo className="siteFooter__logo" variant="headerPrimary" />
					</Link>
					<p>Build strange places. Make your mark.</p>
				</div>

				<section className="siteFooter__newsletter" aria-labelledby="footer-newsletter-title">
					<div>
						<h2 id="footer-newsletter-title">Notes from Mothmark</h2>
						<p>Occasional editor updates, new worlds, and tutorials.</p>
					</div>
					<form action="/info/newsletter" method="get">
						<label htmlFor="footer-email">Email address</label>
						<div>
							<input id="footer-email" type="email" placeholder="you@example.com" required />
							<button type="submit">Subscribe</button>
						</div>
					</form>
				</section>
			</div>

			<div className="siteFooter__directory">
				{footerGroups.map((group) => (
					<nav key={group.title} aria-label={group.ariaLabel}>
						<h2>{group.title}</h2>
						{group.links.map((link) => (
							<Link key={link.href} href={link.href}>
								{link.label}
							</Link>
						))}
					</nav>
				))}

				<section className="siteFooter__social" aria-labelledby="footer-social-title">
					<h2 id="footer-social-title">Follow us</h2>
					<div>
						{socialLinks.map(({label, href, icon: Icon}) => (
							<Link key={href} href={href} aria-label={label} title={label}>
								<Icon size={18} aria-hidden="true" />
							</Link>
						))}
					</div>
				</section>
			</div>

			<div className="siteFooter__base">
				<span>© {new Date().getFullYear()} Mothmark</span>
				<span>Made for rooms, rules, and words.</span>
			</div>
		</footer>
	);
}
