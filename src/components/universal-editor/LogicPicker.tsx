"use client";

import {Search, X} from "lucide-react";
import {
	type KeyboardEvent as ReactKeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {z} from "zod";
import type {PopupApi} from "@/components/popup/Popup";
import {schemaLogicOptions, type SchemaLogicOption} from "./utils/editorSchemaVariants";
import "./LogicPicker.scss";

export type LogicKind = "condition" | "effect";
export type LogicPickerOption = SchemaLogicOption;

export type LogicPickerProps = {
	kind: LogicKind;
	schema: z.ZodTypeAny;
	additionalOptions?: LogicPickerOption[];
	hiddenTypes?: string[];
	selectedKey?: string;
	onChoose: (option: LogicPickerOption) => void;
	onCancel: () => void;
};

function optionMatches(option: LogicPickerOption, query: string) {
	const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
	return terms.every((term) => option.searchText.includes(term));
}

const LOGIC_DOMAIN_ORDER = [
	"Item",
	"Room",
	"Player",
	"World state",
	"Time/randomness",
	"Navigation",
	"Messaging",
] as const;

const RECENT_OPTION_LIMIT = 3;
const EMPTY_LOGIC_OPTIONS: LogicPickerOption[] = [];
const EMPTY_HIDDEN_TYPES: string[] = [];

function recentStorageKey(kind: LogicKind) {
	return `mothmark.logic-picker.recent.${kind}`;
}

function readRecentOptionKeys(kind: LogicKind) {
	try {
		const stored = window.localStorage.getItem(recentStorageKey(kind));
		if (!stored) return [];
		const parsed: unknown = JSON.parse(stored);
		return Array.isArray(parsed)
			? parsed.filter((key): key is string => typeof key === "string").slice(0, RECENT_OPTION_LIMIT)
			: [];
	} catch {
		return [];
	}
}

function writeRecentOptionKeys(kind: LogicKind, keys: string[]) {
	try {
		window.localStorage.setItem(recentStorageKey(kind), JSON.stringify(keys));
	} catch {
		// The chooser still works when browser storage is unavailable.
	}
}

function optionCategory(option: LogicPickerOption) {
	if (option.type.endsWith("-ref") || option.category === "Reusable") return "Saved";
	if (option.category === "Item collection") return "Item";
	if (option.type === "message" || option.category === "Message") return "Messaging";
	if (option.type === "event" || option.operation === "turn-compare") return "Time/randomness";
	if (option.type === "control") {
		return option.operation === "random-branch" ? "Time/randomness" : "World state";
	}
	if (option.type === "comparison") return "Player";
	return option.category;
}

function optionCreationPreview(kind: LogicKind, option: LogicPickerOption) {
	if (option.type.endsWith("-ref")) return `Use saved ${kind} “${option.title}”`;
	if (option.fields.length === 0) return option.title;
	return `${option.title} — ${option.fields.map((field) => `[${field.toLocaleLowerCase()}]`).join(", ")}`;
}

export function LogicPicker({
	kind,
	schema,
	additionalOptions = EMPTY_LOGIC_OPTIONS,
	hiddenTypes = EMPTY_HIDDEN_TYPES,
	selectedKey,
	onChoose,
	onCancel,
}: LogicPickerProps) {
	const searchRef = useRef<HTMLInputElement>(null);
	const resultRefs = useRef(new Map<string, HTMLButtonElement>());
	const schemaOptions = useMemo(
		() => schemaLogicOptions(schema).filter((option) => !hiddenTypes.includes(option.type)),
		[hiddenTypes, schema],
	);
	const options = useMemo(() => {
		const values = new Map<string, LogicPickerOption>();
		for (const option of [...additionalOptions, ...schemaOptions]) values.set(option.key, option);
		return [...values.values()];
	}, [additionalOptions, schemaOptions]);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("All");
	const [recentKeys, setRecentKeys] = useState<string[]>([]);
	const recentOptions = useMemo(
		() => recentKeys.flatMap((key) => options.find((option) => option.key === key) ?? []),
		[options, recentKeys],
	);
	const categories = useMemo(() => {
		const available = new Set(options.map(optionCategory));
		const ordered = LOGIC_DOMAIN_ORDER.filter((name) => available.has(name));
		const remaining = [...available]
			.filter(
				(name) => !LOGIC_DOMAIN_ORDER.some((orderedName) => orderedName === name) && name !== "Saved",
			)
			.sort((left, right) => left.localeCompare(right));
		return [
			...(recentOptions.length > 0 ? ["Recent"] : []),
			"All",
			...ordered,
			...remaining,
			...(available.has("Saved") ? ["Saved"] : []),
		];
	}, [options, recentOptions.length]);
	const filteredOptions = useMemo(() => {
		const source =
			category === "Recent"
				? recentOptions
				: options.filter((option) => category === "All" || optionCategory(option) === category);
		return source.filter((option) => optionMatches(option, query));
	}, [category, options, query, recentOptions]);
	const [activeKey, setActiveKey] = useState(
		selectedKey ?? filteredOptions[0]?.key ?? options[0]?.key ?? "",
	);
	const activeOption =
		filteredOptions.find((option) => option.key === activeKey) ?? filteredOptions[0];

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			const availableKeys = new Set(options.map((option) => option.key));
			const storedKeys = readRecentOptionKeys(kind).filter((key) => availableKeys.has(key));
			setRecentKeys(storedKeys);
			if (!selectedKey && storedKeys[0]) {
				setCategory("Recent");
				setActiveKey(storedKeys[0]);
			}
		}, 0);
		return () => window.clearTimeout(timeout);
	}, [kind, options, selectedKey]);

	function categoryCount(categoryName: string) {
		if (categoryName === "Recent") return recentOptions.length;
		if (categoryName === "All") return options.length;
		return options.filter((option) => optionCategory(option) === categoryName).length;
	}

	function chooseOption(option: LogicPickerOption) {
		const nextRecentKeys = [option.key, ...recentKeys.filter((key) => key !== option.key)].slice(
			0,
			RECENT_OPTION_LIMIT,
		);
		setRecentKeys(nextRecentKeys);
		writeRecentOptionKeys(kind, nextRecentKeys);
		onChoose(option);
	}

	function focusResult(index: number) {
		const option = filteredOptions[index];
		if (!option) return;
		setActiveKey(option.key);
		resultRefs.current.get(option.key)?.focus();
	}

	function handleResultKeyDown(
		event: ReactKeyboardEvent<HTMLButtonElement>,
		option: LogicPickerOption,
		index: number,
	) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			focusResult(Math.min(index + 1, filteredOptions.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			focusResult(Math.max(index - 1, 0));
		} else if (event.key === "Home") {
			event.preventDefault();
			focusResult(0);
		} else if (event.key === "End") {
			event.preventDefault();
			focusResult(filteredOptions.length - 1);
		} else if (event.key === "Enter") {
			event.preventDefault();
			chooseOption(option);
		}
	}

	return (
		<div className="logicPicker">
			<header className="logicPicker__header">
				<div>
					<h2>Choose {kind === "condition" ? "a condition" : "an effect"}</h2>
					<p>{kind === "condition" ? "What must be true?" : "What should happen when this runs?"}</p>
				</div>
				<button type="button" className="logicPicker__close" onClick={onCancel} aria-label="Close">
					<X size={17} aria-hidden="true" />
				</button>
			</header>

			<div className="logicPicker__search">
				<Search size={15} aria-hidden="true" />
				<input
					ref={searchRef}
					type="search"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						if (event.target.value && category !== "All") setCategory("All");
					}}
					onKeyDown={(event) => {
						if (event.key !== "ArrowDown") return;
						event.preventDefault();
						focusResult(
							Math.max(
								0,
								filteredOptions.findIndex((option) => option.key === activeOption?.key),
							),
						);
					}}
					placeholder={
						kind === "condition"
							? "Search by intent, such as outside, carried, locked…"
							: "Search by intent, such as take, reveal, move, remember…"
					}
					aria-label={`Search ${kind}s`}
				/>
			</div>

			<div className="logicPicker__workspace">
				<nav className="logicPicker__categories" aria-label={`${kind} categories`}>
					{categories.map((categoryName) => {
						const count = categoryCount(categoryName);
						return (
							<button
								key={categoryName}
								type="button"
								className={categoryName === "Saved" ? "logicPicker__savedCategory" : undefined}
								aria-pressed={category === categoryName}
								onClick={() => {
									const firstOption =
										categoryName === "Recent"
											? recentOptions[0]
											: options.find(
													(option) => categoryName === "All" || optionCategory(option) === categoryName,
												);
									setCategory(categoryName);
									setQuery("");
									setActiveKey(firstOption?.key ?? "");
								}}
							>
								<span>{categoryName}</span>
								<small>{count}</small>
							</button>
						);
					})}
				</nav>

				<div className="logicPicker__results" role="listbox" aria-label={`${kind} choices`}>
					{filteredOptions.length === 0 ? (
						<div className="logicPicker__empty">
							<strong>No matches</strong>
							<span>Try a broader action, object, or state.</span>
						</div>
					) : null}
					{filteredOptions.map((option, index) => (
						<button
							key={option.key}
							ref={(element) => {
								if (element) resultRefs.current.set(option.key, element);
								else resultRefs.current.delete(option.key);
							}}
							type="button"
							role="option"
							aria-selected={option.key === activeOption?.key}
							onClick={() => setActiveKey(option.key)}
							onDoubleClick={() => chooseOption(option)}
							onKeyDown={(event) => handleResultKeyDown(event, option, index)}
						>
							<strong>{option.title}</strong>
							{option.description ? <span>{option.description}</span> : null}
							<small>{optionCategory(option)}</small>
						</button>
					))}
				</div>

				<aside className="logicPicker__detail">
					{activeOption ? (
						<>
							<div className="logicPicker__detailHeading">
								<small>{optionCategory(activeOption)}</small>
								<h3>{activeOption.title}</h3>
								{activeOption.description ? <p>{activeOption.description}</p> : null}
							</div>

							<section className="logicPicker__creationPreview">
								<h4>Creates</h4>
								<p>{optionCreationPreview(kind, activeOption)}</p>
							</section>

							{activeOption.fields.length > 0 ? (
								<section>
									<h4>You will configure</h4>
									<ul>
										{activeOption.fields.map((field) => (
											<li key={field}>{field}</li>
										))}
									</ul>
								</section>
							) : null}

							{activeOption.example ? (
								<section>
									<h4>Example</h4>
									<p>{activeOption.example}</p>
								</section>
							) : null}

							{activeOption.note || activeOption.requires.length > 0 ? (
								<section>
									<h4>Good to know</h4>
									{activeOption.note ? <p>{activeOption.note}</p> : null}
									{activeOption.requires.length > 0 ? (
										<p>Requires {activeOption.requires.join(", ")}.</p>
									) : null}
								</section>
							) : null}
						</>
					) : null}
				</aside>
			</div>

			<footer className="logicPicker__footer">
				<span>{filteredOptions.length} available</span>
				<div>
					<button type="button" onClick={onCancel}>
						Cancel
					</button>
					<button
						type="button"
						className="logicPicker__choose"
						disabled={!activeOption}
						onClick={() => activeOption && chooseOption(activeOption)}
					>
						Use {kind}
					</button>
				</div>
			</footer>
		</div>
	);
}

export function openLogicPicker(
	popup: PopupApi | undefined,
	request: Omit<LogicPickerProps, "onChoose" | "onCancel">,
) {
	if (!popup) {
		return Promise.resolve(request.additionalOptions?.[0] ?? schemaLogicOptions(request.schema)[0]);
	}

	return popup.open<LogicPickerOption>(
		({resolve, cancel}) => <LogicPicker {...request} onChoose={resolve} onCancel={cancel} />,
		{
			ariaLabel: `Choose ${request.kind}`,
			className: "popupSurfaceLogicPicker",
			closeOnBackdropClick: false,
		},
	);
}
