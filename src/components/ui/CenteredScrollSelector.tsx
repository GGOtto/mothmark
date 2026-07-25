"use client";

import type {ButtonHTMLAttributes, ReactNode, RefObject, UIEvent} from "react";
import {useCallback, useLayoutEffect, useRef} from "react";
import "./CenteredScrollSelector.scss";

type CenteredScrollSelectorProps<TItem> = {
	items: TItem[];
	activeId: string | null;
	onActiveChange: (item: TItem) => void;
	getId: (item: TItem) => string;
	renderLabel: (item: TItem) => ReactNode;
	ariaLabel: string;
	className?: string;
	listClassName?: string;
	indicatorClassName?: string;
	itemClassName?: (item: TItem, isActive: boolean) => string | undefined;
	getItemProps?: (
		item: TItem,
		index: number,
	) => ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>;
	deferClickActivationUntilScroll?: boolean;
	listRef?: RefObject<HTMLDivElement | null>;
};

export function CenteredScrollSelector<TItem>({
	items,
	activeId,
	onActiveChange,
	getId,
	renderLabel,
	ariaLabel,
	className,
	listClassName,
	indicatorClassName,
	itemClassName,
	getItemProps,
	deferClickActivationUntilScroll = false,
	listRef: externalListRef,
}: CenteredScrollSelectorProps<TItem>) {
	const internalListRef = useRef<HTMLDivElement | null>(null);
	const listRef = externalListRef ?? internalListRef;

	const centerItem = useCallback(
		(button: HTMLButtonElement, item: TItem, behavior: ScrollBehavior = "smooth") => {
			if (typeof button.scrollIntoView === "function") {
				button.scrollIntoView({behavior, block: "center", inline: "nearest"});
				if (deferClickActivationUntilScroll) return;
			}
			onActiveChange(item);
		},
		[deferClickActivationUntilScroll, onActiveChange],
	);

	function handleScroll(event: UIEvent<HTMLDivElement>) {
		const list = event.currentTarget;
		const listRect = list.getBoundingClientRect();
		const center = listRect.top + listRect.height / 2;
		let closest: HTMLButtonElement | null = null;
		let distance = Number.POSITIVE_INFINITY;

		for (const button of list.querySelectorAll<HTMLButtonElement>("[data-selector-id]")) {
			const rect = button.getBoundingClientRect();
			const nextDistance = Math.abs(rect.top + rect.height / 2 - center);
			if (nextDistance < distance) {
				closest = button;
				distance = nextDistance;
			}
		}

		if (!closest || closest.dataset.selectorId === activeId) return;
		const item = items.find((candidate) => getId(candidate) === closest?.dataset.selectorId);
		if (item) onActiveChange(item);
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
		event.preventDefault();
		const currentIndex = items.findIndex((item) => getId(item) === activeId);
		const offset = event.key === "ArrowUp" ? -1 : 1;
		const nextItem = items[Math.min(items.length - 1, Math.max(0, currentIndex + offset))];
		if (!nextItem) return;
		const button = Array.from(
			listRef.current?.querySelectorAll<HTMLButtonElement>("[data-selector-id]") ?? [],
		).find((candidate) => candidate.dataset.selectorId === getId(nextItem));
		if (button) centerItem(button, nextItem);
	}

	useLayoutEffect(() => {
		if (!activeId) return;
		const button = Array.from(
			listRef.current?.querySelectorAll<HTMLButtonElement>("[data-selector-id]") ?? [],
		).find((candidate) => candidate.dataset.selectorId === activeId);
		button?.scrollIntoView?.({block: "center", inline: "nearest"});
	}, [activeId, listRef]);

	return (
		<div className={`centeredScrollSelector ${className ?? ""}`}>
			<div
				ref={listRef}
				className={`centeredScrollSelector__list ${listClassName ?? ""}`}
				aria-label={ariaLabel}
				tabIndex={0}
				onScroll={handleScroll}
				onKeyDown={handleKeyDown}
			>
				{items.map((item, index) => {
					const id = getId(item);
					const isActive = id === activeId;
					const itemProps = getItemProps?.(item, index);
					return (
						<button
							{...itemProps}
							key={id}
							type="button"
							aria-pressed={isActive}
							data-selector-id={id}
							className={`centeredScrollSelector__item ${itemClassName?.(item, isActive) ?? ""}`}
							onClick={(event) => centerItem(event.currentTarget, item)}
						>
							{renderLabel(item)}
						</button>
					);
				})}
			</div>
			<div
				className={`centeredScrollSelector__indicator ${indicatorClassName ?? ""}`}
				aria-hidden="true"
			/>
		</div>
	);
}
