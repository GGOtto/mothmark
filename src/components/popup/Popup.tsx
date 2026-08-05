"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {AlertPopup} from "./template/AlertPopup";
import {ConfirmPopup} from "./template/ConfirmPopup";
import {PromptPopup} from "./template/PromptPopup";
import "./Popup.scss";

export type PopupControls<TResult> = {
	resolve: (result: TResult) => void;
	cancel: () => void;
};

export type PopupRenderer<TResult> = (controls: PopupControls<TResult>) => ReactNode;

export type PopupOptions = {
	closeOnBackdropClick?: boolean;
	closeOnEscape?: boolean;
	className?: string;
};

export type AlertPopupOptions = {
	title: ReactNode;
	message?: ReactNode;
	buttonLabel?: string;
	closeOnEscape?: boolean;
};

export type ConfirmPopupOptions = {
	title: ReactNode;
	message?: ReactNode;
	confirmLabel?: string;
	cancelLabel?: string;
	danger?: boolean;
	closeOnEscape?: boolean;
	closeOnBackdropClick?: boolean;
};

export type PromptPopupOptions = {
	title: ReactNode;
	message?: ReactNode;
	label?: string;
	initialValue?: string;
	placeholder?: string;
	submitLabel?: string;
	cancelLabel?: string;
	required?: boolean;
	validate?: (value: string) => string | undefined;
	closeOnEscape?: boolean;
	closeOnBackdropClick?: boolean;
};

export type PopupApi = {
	open<TResult>(
		render: PopupRenderer<TResult>,
		options?: PopupOptions,
	): Promise<TResult | undefined>;

	alert(options: AlertPopupOptions): Promise<void>;

	confirm(options: ConfirmPopupOptions): Promise<boolean>;

	prompt(options: PromptPopupOptions): Promise<string | undefined>;

	close(): void;
};

type ActivePopup = {
	id: number;
	render: PopupRenderer<unknown>;
	options: Required<PopupOptions>;
	returnFocus: HTMLElement | null;
	resolvePromise: (result: unknown | undefined) => void;
};

const DEFAULT_OPTIONS: Required<PopupOptions> = {
	closeOnBackdropClick: true,
	closeOnEscape: true,
	className: "",
};

const PopupContext = createContext<PopupApi | null>(null);

type PopupProviderProps = {
	children: ReactNode;
};

export function PopupProvider({children}: PopupProviderProps) {
	const [activePopup, setActivePopup] = useState<ActivePopup | null>(null);
	const activePopupRef = useRef<ActivePopup | null>(null);
	const nextIdRef = useRef(0);

	const finishPopup = useCallback((result?: unknown, id?: number) => {
		const currentPopup = activePopupRef.current;

		if (!currentPopup || (id !== undefined && currentPopup.id !== id)) {
			return;
		}

		activePopupRef.current = null;
		setActivePopup(null);
		currentPopup.resolvePromise(result);
	}, []);

	useEffect(
		() => () => {
			activePopupRef.current?.resolvePromise(undefined);
			activePopupRef.current = null;
		},
		[],
	);

	const open = useCallback(
		<TResult,>(
			render: PopupRenderer<TResult>,
			options: PopupOptions = {},
		): Promise<TResult | undefined> => {
			return new Promise<TResult | undefined>((resolvePromise) => {
				const popup: ActivePopup = {
					id: nextIdRef.current++,
					render: render as PopupRenderer<unknown>,
					options: {
						...DEFAULT_OPTIONS,
						...options,
					},
					returnFocus: document.activeElement as HTMLElement | null,
					resolvePromise: resolvePromise as (result: unknown | undefined) => void,
				};

				activePopupRef.current?.resolvePromise(undefined);
				activePopupRef.current = popup;
				setActivePopup(popup);
			});
		},
		[],
	);

	const alert = useCallback(
		async (options: AlertPopupOptions): Promise<void> => {
			await open<void>(
				({resolve}) => (
					<AlertPopup
						title={options.title}
						message={options.message}
						buttonLabel={options.buttonLabel}
						onClose={() => resolve()}
					/>
				),
				{
					closeOnBackdropClick: false,
					closeOnEscape: options.closeOnEscape ?? true,
					className: "popupSurfaceAlert",
				},
			);
		},
		[open],
	);

	const confirm = useCallback(
		async (options: ConfirmPopupOptions): Promise<boolean> => {
			const result = await open<boolean>(
				({resolve, cancel}) => (
					<ConfirmPopup
						title={options.title}
						message={options.message}
						confirmLabel={options.confirmLabel}
						cancelLabel={options.cancelLabel}
						danger={options.danger}
						onConfirm={() => resolve(true)}
						onCancel={cancel}
					/>
				),
				{
					closeOnBackdropClick: options.closeOnBackdropClick ?? false,
					closeOnEscape: options.closeOnEscape ?? true,
					className: "popupSurfaceConfirm",
				},
			);

			return result ?? false;
		},
		[open],
	);

	const prompt = useCallback(
		async (options: PromptPopupOptions): Promise<string | undefined> => {
			return open<string>(
				({resolve, cancel}) => (
					<PromptPopup
						title={options.title}
						message={options.message}
						label={options.label}
						initialValue={options.initialValue}
						placeholder={options.placeholder}
						submitLabel={options.submitLabel}
						cancelLabel={options.cancelLabel}
						required={options.required}
						validate={options.validate}
						onSubmit={resolve}
						onCancel={cancel}
					/>
				),
				{
					closeOnBackdropClick: options.closeOnBackdropClick ?? false,
					closeOnEscape: options.closeOnEscape ?? true,
					className: "popupSurfacePrompt",
				},
			);
		},
		[open],
	);

	const api = useMemo<PopupApi>(
		() => ({
			open,
			alert,
			confirm,
			prompt,
			close: () => finishPopup(undefined),
		}),
		[alert, confirm, finishPopup, open, prompt],
	);

	return (
		<PopupContext.Provider value={api}>
			{children}

			{activePopup && (
				<PopupHost
					key={activePopup.id}
					popup={activePopup}
					onFinish={(result) => finishPopup(result, activePopup.id)}
				/>
			)}
		</PopupContext.Provider>
	);
}

export function usePopup(): PopupApi {
	const popup = useContext(PopupContext);

	if (!popup) {
		throw new Error("usePopup must be used inside a PopupProvider.");
	}

	return popup;
}

type PopupHostProps = {
	popup: ActivePopup;
	onFinish: (result?: unknown) => void;
};

function PopupHost({popup, onFinish}: PopupHostProps) {
	const {options} = popup;
	const surfaceRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const surface = surfaceRef.current;
		const focusTarget = surface?.querySelector<HTMLElement>(
			"button, input, select, textarea, [tabindex]:not([tabindex='-1'])",
		);

		(focusTarget ?? surface)?.focus();

		return () => popup.returnFocus?.focus();
	}, [popup.returnFocus]);

	useEffect(() => {
		if (!options.closeOnEscape) return;

		function closeOnEscape(event: KeyboardEvent): void {
			if (event.key !== "Escape") return;

			event.preventDefault();
			onFinish(undefined);
		}

		document.addEventListener("keydown", closeOnEscape);
		return () => document.removeEventListener("keydown", closeOnEscape);
	}, [onFinish, options.closeOnEscape]);

	function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>): void {
		if (options.closeOnBackdropClick && event.target === event.currentTarget) {
			onFinish(undefined);
		}
	}

	return (
		<div className="popupBackdrop" role="presentation" onMouseDown={handleBackdropClick}>
			<div
				ref={surfaceRef}
				className={["popupSurface", options.className].filter(Boolean).join(" ")}
				role="dialog"
				aria-modal="true"
				tabIndex={-1}
			>
				{popup.render({
					resolve: onFinish,
					cancel: () => onFinish(undefined),
				})}
			</div>
		</div>
	);
}
