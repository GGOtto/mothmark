import {expect, type Page} from "@playwright/test";

type MobileLayoutAuditOptions = {
	root?: string;
};

type MobileLayoutIssue = {
	elements: string[];
	kind: "clipped" | "overlap";
};

/**
 * Guards the mobile layout contract for the current visible state. Horizontal
 * scroll rails are treated as intentional; every other interactive control
 * must stay inside its surface and clear of sibling controls.
 */
export async function expectMobileLayoutIntegrity(
	page: Page,
	{root = "body"}: MobileLayoutAuditOptions = {},
) {
	const audit = await page.evaluate((rootSelector) => {
		const rootElement = document.querySelector<HTMLElement>(rootSelector);
		if (!rootElement) throw new Error(`Mobile layout audit root not found: ${rootSelector}`);

		const visible = (element: HTMLElement) => {
			const style = getComputedStyle(element);
			const rect = element.getBoundingClientRect();
			return (
				style.display !== "none" &&
				style.visibility !== "hidden" &&
				Number(style.opacity) !== 0 &&
				rect.width > 1 &&
				rect.height > 1
			);
		};
		const describe = (element: HTMLElement) => {
			const name =
				element.getAttribute("aria-label") ??
				element.getAttribute("title") ??
				element.textContent?.replace(/\s+/g, " ").trim().slice(0, 60) ??
				"";
			const identity = [
				element.tagName.toLowerCase(),
				...Array.from(element.classList).slice(0, 2),
			].join(".");
			return name ? `${identity} (${name})` : identity;
		};
		const hasHorizontalScrollRail = (element: HTMLElement) => {
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== rootElement.parentElement) {
				const style = getComputedStyle(ancestor);
				if (
					(style.overflowX === "auto" || style.overflowX === "scroll") &&
					ancestor.scrollWidth > ancestor.clientWidth + 1
				) {
					return true;
				}
				if (ancestor === rootElement) break;
				ancestor = ancestor.parentElement;
			}
			return false;
		};
		const paintedRect = (element: HTMLElement) => {
			const source = element.getBoundingClientRect();
			const bounds = {
				bottom: Math.min(window.innerHeight, source.bottom),
				left: Math.max(0, source.left),
				right: Math.min(window.innerWidth, source.right),
				top: Math.max(0, source.top),
			};
			let ancestor = element.parentElement;
			while (ancestor && ancestor !== rootElement.parentElement) {
				const style = getComputedStyle(ancestor);
				const ancestorRect = ancestor.getBoundingClientRect();
				if (["auto", "clip", "hidden", "scroll"].includes(style.overflowX)) {
					bounds.left = Math.max(bounds.left, ancestorRect.left);
					bounds.right = Math.min(bounds.right, ancestorRect.right);
				}
				if (["auto", "clip", "hidden", "scroll"].includes(style.overflowY)) {
					bounds.top = Math.max(bounds.top, ancestorRect.top);
					bounds.bottom = Math.min(bounds.bottom, ancestorRect.bottom);
				}
				if (ancestor === rootElement) break;
				ancestor = ancestor.parentElement;
			}
			return {
				...bounds,
				height: Math.max(0, bounds.bottom - bounds.top),
				width: Math.max(0, bounds.right - bounds.left),
			};
		};
		const selector =
			"button:not([disabled]), a[href], input:not([type='hidden']), select, textarea, [role='tab'], [role='menuitem']";
		const controls = Array.from(rootElement.querySelectorAll<HTMLElement>(selector)).filter(
			(element) => {
				const painted = paintedRect(element);
				return (
					visible(element) &&
					!element.closest("[hidden], [aria-hidden='true']") &&
					// Authored map entities intentionally move through the clipped, pannable canvas.
					!element.closest(".mapViewport") &&
					painted.width > 1 &&
					painted.height > 1
				);
			},
		);
		const rootRect = rootElement.getBoundingClientRect();
		const horizontalBounds = {
			left: Math.max(0, rootRect.left),
			right: Math.min(window.innerWidth, rootRect.right),
		};
		const issues: MobileLayoutIssue[] = [];

		for (const control of controls) {
			if (hasHorizontalScrollRail(control)) continue;
			const rect = control.getBoundingClientRect();
			if (rect.left < horizontalBounds.left - 1 || rect.right > horizontalBounds.right + 1) {
				issues.push({kind: "clipped", elements: [describe(control)]});
			}
		}

		for (let leftIndex = 0; leftIndex < controls.length; leftIndex += 1) {
			const left = controls[leftIndex];
			if (!left || hasHorizontalScrollRail(left)) continue;
			const leftRect = paintedRect(left);
			for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
				const right = controls[rightIndex];
				if (!right || hasHorizontalScrollRail(right)) continue;
				if (left.contains(right) || right.contains(left)) continue;
				const rightRect = paintedRect(right);
				const overlapWidth =
					Math.min(leftRect.right, rightRect.right) - Math.max(leftRect.left, rightRect.left);
				const overlapHeight =
					Math.min(leftRect.bottom, rightRect.bottom) - Math.max(leftRect.top, rightRect.top);
				if (overlapWidth > 2 && overlapHeight > 2) {
					issues.push({kind: "overlap", elements: [describe(left), describe(right)]});
				}
			}
		}

		return {
			documentWidth: document.documentElement.scrollWidth,
			issues,
			viewportWidth: window.innerWidth,
		};
	}, root);

	expect(audit.documentWidth, "The page must not overflow the mobile viewport").toBeLessThanOrEqual(
		audit.viewportWidth + 1,
	);
	expect(audit.issues, "Mobile controls must stay within their surface without overlapping").toEqual(
		[],
	);
}
