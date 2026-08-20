import {ArrowRight} from "lucide-react";
import Link from "next/link";

import {FeaturedPublicationsCarousel} from "./FeaturedPublicationsCarousel";
import {HomeExample} from "./HomeExample";
import {HomeScrollReset} from "./HomeScrollReset";
import {SiteFooter} from "@/components/footer/SiteFooter";

import "./page.scss";

export default function HomePage() {
	return (
		<div className="homePage">
			<HomeScrollReset />
			<main>
				<section className="homeIntro" id="about-mothmark">
					<div className="homeIntroCopy">
						<h1>A place to build and play text adventures.</h1>
						<p>
							Map places, write commands, shape the rules, and test every turn in one connected browser
							workspace.
						</p>
						<div className="homeIntroActions">
							<Link href="/worlds" className="homePrimaryAction">
								Start building
							</Link>
							<Link href="/play" className="homeSecondaryAction">
								Find a world to play
							</Link>
						</div>
					</div>

					<HomeExample />
				</section>

				<FeaturedPublicationsCarousel />

				<section className="homeGetStarted" aria-label="Get started with Mothmark">
					<article className="homeTutorial" aria-labelledby="home-tutorial-title">
						<h2 id="home-tutorial-title">Build your first room</h2>
						<p>
							Follow a short tutorial through the editor and make a playable scene while learning the parts
							of a Mothmark world.
						</p>
						<ol>
							<li>
								<span>1</span>
								<div>
									<strong>Place a room</strong>
									<small>Give the player somewhere to begin.</small>
								</div>
							</li>
							<li>
								<span>2</span>
								<div>
									<strong>Add an item</strong>
									<small>Write what the player can examine.</small>
								</div>
							</li>
							<li>
								<span>3</span>
								<div>
									<strong>Try a command</strong>
									<small>Play the scene in the embedded terminal.</small>
								</div>
							</li>
						</ol>
						<Link href="/worlds" className="homePrimaryAction">
							Open the editor <ArrowRight size={16} aria-hidden="true" />
						</Link>
					</article>
				</section>
			</main>

			<SiteFooter />
		</div>
	);
}
