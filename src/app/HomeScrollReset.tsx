"use client";

import {useEffect} from "react";

export function HomeScrollReset() {
	useEffect(() => {
		const page = document.querySelector<HTMLElement>(".homePage");
		if (!page) return;

		let secondFrame = 0;
		const reset = () => {
			page.scrollTop = 0;
		};
		const firstFrame = window.requestAnimationFrame(() => {
			reset();
			secondFrame = window.requestAnimationFrame(reset);
		});

		reset();
		window.addEventListener("pageshow", reset);
		return () => {
			window.cancelAnimationFrame(firstFrame);
			window.cancelAnimationFrame(secondFrame);
			window.removeEventListener("pageshow", reset);
		};
	}, []);

	return null;
}
