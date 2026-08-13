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
import {ModalLayer} from "../overlay/Overlay";
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
	ariaLabel?: string;
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
	ariaLabel: "",
	closeOnBackdropClick: true,
	closeOnEscape: true,
	className: "",
};

const PopupContext = createContext<PopupApi | null>(null);

type PopupProviderProps = {
	children: ReactNode;
};

export function PopupProvider({children}: PopupProviderProps) {
	const [popupStack, setPopupStack] = useState<ActivePopup[]>([]);
	const popupStackRef = useRef<ActivePopup[]>([]);
	const nextIdRef = useRef(0);

	const finishPopup = useCallback((result?: unknown, id?: number) => {
		const currentPopup = popupStackRef.current.at(-1);

		if (!currentPopup || (id !== undefined && currentPopup.id !== id)) {
			return;
		}

		const nextStack = popupStackRef.current.slice(0, -1);
		popupStackRef.current = nextStack;
		setPopupStack(nextStack);
		currentPopup.resolvePromise(result);
	}, []);

	useEffect(
		() => () => {
			popupStackRef.current.forEach((popup) => popup.resolvePromise(undefined));
			popupStackRef.current = [];
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

				const nextStack = [...popupStackRef.current, popup];
				popupStackRef.current = nextStack;
				setPopupStack(nextStack);
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
					ariaLabel: typeof options.title === "string" ? options.title : "Alert",
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
					ariaLabel: typeof options.title === "string" ? options.title : "Confirmation",
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
					ariaLabel: typeof options.title === "string" ? options.title : "Prompt",
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

			{popupStack.map((popup, index) => (
				<PopupHost
					key={popup.id}
					active={index === popupStack.length - 1}
					popup={popup}
					onFinish={(result) => finishPopup(result, popup.id)}
				/>
			))}
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

/** Returns the popup API when a provider is present without requiring one. */
export function useOptionalPopup(): PopupApi | undefined {
	return useContext(PopupContext) ?? undefined;
}

type PopupHostProps = {
	active: boolean;
	popup: ActivePopup;
	onFinish: (result?: unknown) => void;
};

function PopupHost({active, popup, onFinish}: PopupHostProps) {
	const {options} = popup;
	const returnFocusRef = useMemo(() => ({current: popup.returnFocus}), [popup.returnFocus]);

	return (
		<ModalLayer
			active={active}
			ariaLabel={options.ariaLabel || undefined}
			backdropClassName="popupBackdrop"
			className={["popupSurface", options.className].filter(Boolean).join(" ")}
			closeOnBackdropClick={options.closeOnBackdropClick}
			closeOnEscape={options.closeOnEscape}
			mobilePresentation="sheet"
			onClose={() => onFinish(undefined)}
			returnFocusRef={returnFocusRef}
		>
			{popup.render({
				resolve: onFinish,
				cancel: () => onFinish(undefined),
			})}
		</ModalLayer>
	);
}
