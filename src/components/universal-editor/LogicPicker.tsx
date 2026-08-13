"use client";

import {Search, X} from "lucide-react";
import {useEffect, useMemo, useRef, useState} from "react";
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

export function LogicPicker({
	kind,
	schema,
	additionalOptions = [],
	hiddenTypes = [],
	selectedKey,
	onChoose,
	onCancel,
}: LogicPickerProps) {
	const searchRef = useRef<HTMLInputElement>(null);
	const schemaOptions = useMemo(
		() => schemaLogicOptions(schema).filter((option) => !hiddenTypes.includes(option.type)),
		[hiddenTypes, schema],
	);
	const options = useMemo(() => {
		const values = new Map<string, LogicPickerOption>();
		for (const option of [...additionalOptions, ...schemaOptions]) values.set(option.key, option);
		return [...values.values()];
	}, [additionalOptions, schemaOptions]);
	const categories = useMemo(
		() => ["All", ...new Set(options.map((option) => option.category))],
		[options],
	);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("All");
	const filteredOptions = useMemo(
		() =>
			options.filter(
				(option) =>
					(category === "All" || option.category === category) && optionMatches(option, query),
			),
		[category, options, query],
	);
	const [activeKey, setActiveKey] = useState(
		selectedKey ?? filteredOptions[0]?.key ?? options[0]?.key ?? "",
	);
	const activeOption =
		filteredOptions.find((option) => option.key === activeKey) ?? filteredOptions[0];

	useEffect(() => {
		searchRef.current?.focus();
	}, []);

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
					onChange={(event) => setQuery(event.target.value)}
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
						const count =
							categoryName === "All"
								? options.length
								: options.filter((option) => option.category === categoryName).length;
						return (
							<button
								key={categoryName}
								type="button"
								aria-pressed={category === categoryName}
								onClick={() => setCategory(categoryName)}
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
					{filteredOptions.map((option) => (
						<button
							key={option.key}
							type="button"
							role="option"
							aria-selected={option.key === activeOption?.key}
							onClick={() => setActiveKey(option.key)}
							onDoubleClick={() => onChoose(option)}
						>
							<strong>{option.title}</strong>
							{option.description ? <span>{option.description}</span> : null}
							<small>{option.category}</small>
						</button>
					))}
				</div>

				<aside className="logicPicker__detail">
					{activeOption ? (
						<>
							<div className="logicPicker__detailHeading">
								<small>{activeOption.category}</small>
								<h3>{activeOption.title}</h3>
								{activeOption.description ? <p>{activeOption.description}</p> : null}
							</div>

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
						onClick={() => activeOption && onChoose(activeOption)}
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
