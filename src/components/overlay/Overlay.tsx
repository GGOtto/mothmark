"use client";

import {
	type CSSProperties,
	type MouseEvent as ReactMouseEvent,
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {createPortal} from "react-dom";
import "./Overlay.scss";

const FOCUSABLE_SELECTOR = [
	"a[href]",
	"button:not([disabled])",
	"input:not([disabled])",
	"select:not([disabled])",
	"textarea:not([disabled])",
	"[tabindex]:not([tabindex='-1'])",
].join(",");

const ANCHOR_GAP = 6;
const VIEWPORT_PADDING = 8;
let bodyLockCount = 0;
let bodyOverflowBeforeLock = "";

type ViewportBox = {
	height: number;
	left: number;
	top: number;
	width: number;
};

function visibleViewport(): ViewportBox {
	const viewport = window.visualViewport;
	return {
		height: viewport?.height ?? window.innerHeight,
		left: viewport?.offsetLeft ?? 0,
		top: viewport?.offsetTop ?? 0,
		width: viewport?.width ?? window.innerWidth,
	};
}

function lockBodyScroll(): () => void {
	if (bodyLockCount === 0) {
		bodyOverflowBeforeLock = document.body.style.overflow;
		document.body.style.overflow = "hidden";
	}
	bodyLockCount += 1;

	return () => {
		bodyLockCount = Math.max(0, bodyLockCount - 1);
		if (bodyLockCount === 0) document.body.style.overflow = bodyOverflowBeforeLock;
	};
}

function focusableElements(surface: HTMLElement): HTMLElement[] {
	return Array.from(surface.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
		(element) => element.getAttribute("aria-hidden") !== "true" && !element.hidden,
	);
}

function useVisualViewport(active: boolean, onChange: (viewport: ViewportBox) => void): void {
	useEffect(() => {
		if (!active) return;
		const viewport = window.visualViewport;
		const sync = () => onChange(visibleViewport());
		sync();
		viewport?.addEventListener("resize", sync);
		viewport?.addEventListener("scroll", sync);
		window.addEventListener("resize", sync);
		return () => {
			viewport?.removeEventListener("resize", sync);
			viewport?.removeEventListener("scroll", sync);
			window.removeEventListener("resize", sync);
		};
	}, [active, onChange]);
}

function useModalBehavior({
	active,
	closeOnEscape,
	initialFocusRef,
	onClose,
	returnFocusRef,
	surfaceRef,
}: {
	active: boolean;
	closeOnEscape: boolean;
	initialFocusRef?: RefObject<HTMLElement | null>;
	onClose: () => void;
	returnFocusRef?: RefObject<HTMLElement | null>;
	surfaceRef: RefObject<HTMLElement | null>;
}): void {
	const capturedReturnFocus = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!active) return;
		const explicitReturnFocus = returnFocusRef?.current;
		capturedReturnFocus.current = explicitReturnFocus ?? (document.activeElement as HTMLElement);
		const unlock = lockBodyScroll();
		const surface = surfaceRef.current;
		const preferred = initialFocusRef?.current;
		const firstFocusable = surface ? focusableElements(surface)[0] : undefined;
		(preferred ?? firstFocusable ?? surface)?.focus();

		return () => {
			unlock();
			const focusTarget = explicitReturnFocus ?? capturedReturnFocus.current;
			if (focusTarget?.isConnected) focusTarget.focus();
		};
	}, [active, initialFocusRef, returnFocusRef, surfaceRef]);

	useEffect(() => {
		if (!active) return;
		function handleKeyDown(event: KeyboardEvent): void {
			if (event.key === "Escape" && closeOnEscape) {
				event.preventDefault();
				onClose();
				return;
			}
			if (event.key !== "Tab") return;
			const surface = surfaceRef.current;
			if (!surface) return;
			const focusable = focusableElements(surface);
			if (focusable.length === 0) {
				event.preventDefault();
				surface.focus();
				return;
			}
			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [active, closeOnEscape, onClose, surfaceRef]);
}

export type ModalLayerProps = {
	ariaLabel?: string;
	ariaLabelledBy?: string;
	backdropClassName?: string;
	children: ReactNode;
	className?: string;
	closeOnBackdropClick?: boolean;
	closeOnEscape?: boolean;
	initialFocusRef?: RefObject<HTMLElement | null>;
	mobilePresentation?: "dialog" | "sheet";
	onClose: () => void;
	returnFocusRef?: RefObject<HTMLElement | null>;
	surfaceRef?: RefObject<HTMLElement | null>;
};

export function ModalLayer({
	ariaLabel,
	ariaLabelledBy,
	backdropClassName,
	children,
	className,
	closeOnBackdropClick = true,
	closeOnEscape = true,
	initialFocusRef,
	mobilePresentation = "dialog",
	onClose,
	returnFocusRef,
	surfaceRef: suppliedSurfaceRef,
}: ModalLayerProps) {
	const internalSurfaceRef = useRef<HTMLElement>(null);
	const surfaceRef = suppliedSurfaceRef ?? internalSurfaceRef;
	const backdropRef = useRef<HTMLDivElement>(null);
	const syncViewport = useCallback((viewport: ViewportBox) => {
		const backdrop = backdropRef.current;
		if (!backdrop) return;
		backdrop.style.setProperty("--overlay-viewport-left", `${viewport.left}px`);
		backdrop.style.setProperty("--overlay-viewport-top", `${viewport.top}px`);
		backdrop.style.setProperty("--overlay-viewport-width", `${viewport.width}px`);
		backdrop.style.setProperty("--overlay-viewport-height", `${viewport.height}px`);
	}, []);

	useVisualViewport(true, syncViewport);
	useModalBehavior({
		active: true,
		closeOnEscape,
		initialFocusRef,
		onClose,
		returnFocusRef,
		surfaceRef,
	});

	function handleBackdrop(event: ReactMouseEvent<HTMLDivElement>): void {
		if (closeOnBackdropClick && event.target === event.currentTarget) onClose();
	}

	if (typeof document === "undefined") return null;

	return createPortal(
		<div
			ref={backdropRef}
			className={[
				"overlayBackdrop",
				mobilePresentation === "sheet" && "overlayBackdrop--mobileSheet",
				backdropClassName,
			]
				.filter(Boolean)
				.join(" ")}
			role="presentation"
			onPointerDown={handleBackdrop}
		>
			<section
				ref={surfaceRef as RefObject<HTMLElement>}
				className={["overlaySurface", className].filter(Boolean).join(" ")}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
				aria-labelledby={ariaLabelledBy}
				tabIndex={-1}
			>
				{children}
			</section>
		</div>,
		document.body,
	);
}

export type AnchoredLayerProps = {
	anchorRef: RefObject<HTMLElement | null>;
	ariaLabel?: string;
	children: ReactNode;
	className?: string;
	id?: string;
	mobilePresentation?: "anchored" | "sheet";
	matchViewportWidth?: boolean;
	onClose: () => void;
	preferredWidth?: number;
	role?: "dialog" | "listbox" | "menu" | "navigation";
	style?: CSSProperties;
};

export function AnchoredLayer({
	anchorRef,
	ariaLabel,
	children,
	className,
	id,
	matchViewportWidth = false,
	mobilePresentation = "anchored",
	onClose,
	preferredWidth,
	role = "menu",
	style,
}: AnchoredLayerProps) {
	const surfaceRef = useRef<HTMLElement>(null);
	const backdropRef = useRef<HTMLDivElement>(null);
	const [mobileSheet, setMobileSheet] = useState(false);
	const [position, setPosition] = useState<CSSProperties>({visibility: "hidden"});

	const updatePosition = useCallback(() => {
		const anchor = anchorRef.current;
		const surface = surfaceRef.current;
		if (!anchor || !surface) return;
		const viewport = visibleViewport();
		const backdrop = backdropRef.current;
		backdrop?.style.setProperty("--overlay-viewport-left", `${viewport.left}px`);
		backdrop?.style.setProperty("--overlay-viewport-top", `${viewport.top}px`);
		backdrop?.style.setProperty("--overlay-viewport-width", `${viewport.width}px`);
		backdrop?.style.setProperty("--overlay-viewport-height", `${viewport.height}px`);
		const shouldUseSheet =
			mobilePresentation === "sheet" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(max-width: 600px)").matches;
		setMobileSheet(shouldUseSheet);
		if (shouldUseSheet) {
			setPosition({});
			return;
		}

		const rect = anchor.getBoundingClientRect();
		const maxWidth = Math.max(0, viewport.width - VIEWPORT_PADDING * 2);
		const width = matchViewportWidth
			? viewport.width
			: Math.min(preferredWidth ?? surface.offsetWidth, maxWidth);
		const left = matchViewportWidth
			? viewport.left
			: Math.min(
					Math.max(viewport.left + VIEWPORT_PADDING, rect.left),
					viewport.left + viewport.width - width - VIEWPORT_PADDING,
				);
		const viewportBottom = viewport.top + viewport.height;
		const below = viewportBottom - rect.bottom - VIEWPORT_PADDING - ANCHOR_GAP;
		const above = rect.top - viewport.top - VIEWPORT_PADDING - ANCHOR_GAP;
		const placeBelow = below >= Math.min(160, surface.scrollHeight) || below >= above;
		const availableHeight = Math.max(80, placeBelow ? below : above);

		setPosition({
			bottom: placeBelow ? "auto" : viewportBottom - rect.top + ANCHOR_GAP,
			left,
			maxHeight: availableHeight,
			position: "fixed",
			right: "auto",
			top: placeBelow ? rect.bottom + ANCHOR_GAP : "auto",
			visibility: "visible",
			width: preferredWidth || matchViewportWidth ? width : undefined,
		});
	}, [anchorRef, matchViewportWidth, mobilePresentation, preferredWidth]);

	useLayoutEffect(() => {
		const frame = window.requestAnimationFrame(updatePosition);
		return () => window.cancelAnimationFrame(frame);
	}, [updatePosition]);
	useVisualViewport(true, updatePosition);

	useEffect(() => {
		function handlePointerDown(event: PointerEvent): void {
			const target = event.target as Node;
			if (surfaceRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
			onClose();
		}
		function handleEscape(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onClose();
			anchorRef.current?.focus();
		}
		document.addEventListener("pointerdown", handlePointerDown, true);
		document.addEventListener("keydown", handleEscape);
		window.addEventListener("scroll", updatePosition, true);
		return () => {
			document.removeEventListener("pointerdown", handlePointerDown, true);
			document.removeEventListener("keydown", handleEscape);
			window.removeEventListener("scroll", updatePosition, true);
		};
	}, [anchorRef, onClose, updatePosition]);

	useModalBehavior({
		active: mobileSheet,
		closeOnEscape: true,
		onClose,
		returnFocusRef: anchorRef,
		surfaceRef,
	});

	useEffect(() => {
		if (mobileSheet) return;
		const anchor = anchorRef.current;
		const firstFocusable = surfaceRef.current ? focusableElements(surfaceRef.current)[0] : undefined;
		(firstFocusable ?? surfaceRef.current)?.focus();
		return () => {
			if (anchor?.isConnected) anchor.focus();
		};
	}, [anchorRef, mobileSheet]);

	if (typeof document === "undefined") return null;
	return createPortal(
		<div
			ref={backdropRef}
			className={mobileSheet ? "anchoredLayerBackdrop anchoredLayerBackdrop--sheet" : undefined}
			role="presentation"
		>
			<section
				ref={surfaceRef}
				id={id}
				className={["anchoredLayer", mobileSheet && "anchoredLayer--sheet", className]
					.filter(Boolean)
					.join(" ")}
				role={role}
				aria-label={ariaLabel}
				aria-modal={mobileSheet && role === "dialog" ? "true" : undefined}
				tabIndex={mobileSheet ? -1 : undefined}
				style={{...position, ...style}}
			>
				{children}
			</section>
		</div>,
		document.body,
	);
}
