"use client";

import {useEffect, useMemo, useRef, useState} from "react";
import type {
	EditorControlMetadata,
	EditorControlProps,
	EditorFieldGroupMetadata,
	EditorPath,
} from "../../types/universalEditorTypes";
import {resolveEditorControlAppearance} from "../../types/universalEditorTypes";
import {generateEditorSummary} from "../../utils/universalEditorUtils";
import {FieldShell} from "./FieldShell";
import {renderEditorControl} from "./renderEditorControl";
import "./ObjectEditor.scss";

export type ObjectFieldMetadata = {
	key: string;
	metadata: EditorControlMetadata & Record<string, unknown>;
	defaultValue?: unknown;
	error?: string;
	warnings?: string[];
};

export type ObjectFeatures = {
	showFieldCount?: boolean;
	layout?: "stack" | "grid" | "inline";
	groups?: EditorFieldGroupMetadata[];
	fields?: ObjectFieldMetadata[];
	showOutline?: boolean;
	searchable?: boolean;
	emptyTitle?: string;
	emptyDescription?: string;
	emptyActionLabel?: string;
	emptyState?: string;
	defaultValue?: Record<string, unknown>;
};

export type ObjectControlMetadata = EditorControlMetadata & {
	type: "object";
	features?: ObjectFeatures;
};

export type ObjectEditorProps = EditorControlProps<Record<string, unknown>, ObjectControlMetadata>;

function isObjectValue(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown) {
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (value === null) return "null";
	return JSON.stringify(value, null, 2);
}

function resolveFieldGroupId(field: ObjectFieldMetadata) {
	return field.metadata.layout?.group ?? field.metadata.layout?.section;
}

function getFieldSearchText(field: ObjectFieldMetadata, group?: EditorFieldGroupMetadata) {
	return [
		field.key,
		field.metadata.title,
		field.metadata.description,
		field.metadata.placeholder,
		group?.title,
		group?.description,
		field.metadata.layout?.group,
		field.metadata.layout?.section,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

function groupMatchesSearch(
	fields: ObjectFieldMetadata[],
	group: EditorFieldGroupMetadata,
	searchTerm: string,
) {
	if (!searchTerm) return true;
	const needle = searchTerm.toLowerCase();
	return fields.some((field) => getFieldSearchText(field, group).includes(needle));
}

function isScrollableElement(element: HTMLElement) {
	const style = window.getComputedStyle(element);
	return /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight;
}

function getObjectScrollContainer(element: HTMLElement): HTMLElement | Window {
	let parent = element.parentElement;

	while (parent) {
		if (isScrollableElement(parent)) return parent;
		parent = parent.parentElement;
	}

	return window;
}

function getContainerTop(container: HTMLElement | Window) {
	return container instanceof Window ? 0 : container.getBoundingClientRect().top;
}

function getStickyOffset(element: HTMLElement) {
	const rawValue = window
		.getComputedStyle(element)
		.getPropertyValue("--universal-editor-section-sticky-top");
	const parsedValue = Number.parseFloat(rawValue);
	return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function getActiveSectionLine(element: HTMLElement, container: HTMLElement | Window) {
	const shellHeader = element
		.closest<HTMLElement>(".universalEditor")
		?.querySelector<HTMLElement>(".universalEditor__shellHeader");

	if (shellHeader) return shellHeader.getBoundingClientRect().bottom - 6;

	return getContainerTop(container) + getStickyOffset(element) + 8;
}

function renderField({
	field,
	value,
	onChange,
	path,
	disabled,
	readonly,
	context,
}: {
	field: ObjectFieldMetadata;
	value: Record<string, unknown>;
	onChange: (nextValue: Record<string, unknown>) => void;
	path: EditorPath;
	disabled?: boolean;
	readonly?: boolean;
	context: ObjectEditorProps["context"];
}) {
	const childPath: EditorPath = [...path, field.key];
	const childValue = value[field.key] ?? field.defaultValue;
	const width = field.metadata.layout?.width ?? "full";

	return (
		<div
			key={field.key}
			className={["objectEditor__field", `objectEditor__field--width-${width}`].join(" ")}
		>
			{renderEditorControl({
				value: childValue,
				onChange: (nextValue) => {
					onChange({
						...value,
						[field.key]: nextValue,
					});
				},
				metadata: field.metadata,
				path: childPath,
				error: field.error,
				warnings: field.warnings,
				disabled,
				readonly,
				context,
			})}
		</div>
	);
}

export function ObjectEditor({
	value,
	onChange,
	metadata,
	path,
	error,
	warnings,
	disabled,
	readonly,
	context,
}: ObjectEditorProps) {
	const objectRef = useRef<HTMLDivElement | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const appearance = resolveEditorControlAppearance(context.appearance, metadata.appearance);
	const fields = useMemo(
		() => (metadata.features?.fields ?? []).filter((field) => !field.metadata.hidden),
		[metadata.features?.fields],
	);
	const entries = Object.entries(value);
	const isDisabled = disabled || metadata.disabled;
	const isReadonly = readonly || metadata.readonly;
	const canEdit = !isDisabled && !isReadonly;
	const configuredGroups = useMemo(
		() => metadata.features?.groups ?? [],
		[metadata.features?.groups],
	);
	const shouldRenderSections = configuredGroups.length > 0;
	const searchable = Boolean(metadata.features?.searchable || fields.length >= 8);
	const visibleSearchTerm = searchTerm.trim().toLowerCase();
	const fieldCount = fields.length || entries.length;
	const objectSummary = generateEditorSummary(value, metadata.summary);

	const groupedSections = useMemo(() => {
		const sections = configuredGroups
			.map((group, index) => {
				const subgroups = [...(group.groups ?? [])]
					.sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY))
					.map((subgroup) => ({
						group: subgroup,
						fields: fields.filter((field) => resolveFieldGroupId(field) === subgroup.id),
					}))
					.filter((subgroup) => subgroup.fields.length > 0);
				const subgroupIds = new Set((group.groups ?? []).map((subgroup) => subgroup.id));
				const groupFields = fields.filter(
					(field) =>
						resolveFieldGroupId(field) === group.id && !subgroupIds.has(resolveFieldGroupId(field) ?? ""),
				);

				return {index, group, fields: groupFields, subgroups};
			})
			.filter((section) => section.fields.length > 0 || section.subgroups.length > 0);

		return sections.sort((a, b) => {
			const orderDiff =
				(a.group.order ?? Number.POSITIVE_INFINITY) - (b.group.order ?? Number.POSITIVE_INFINITY);
			if (orderDiff !== 0) return orderDiff;
			return a.index - b.index;
		});
	}, [configuredGroups, fields]);

	const ungroupedFields = useMemo(
		() =>
			fields.filter((field) => {
				const groupId = resolveFieldGroupId(field);
				return (
					!groupId ||
					!configuredGroups.some(
						(group) => group.id === groupId || group.groups?.some((subgroup) => subgroup.id === groupId),
					)
				);
			}),
		[configuredGroups, fields],
	);

	const matchingSections = useMemo(
		() =>
			groupedSections
				.map((section) => ({
					...section,
					fields: visibleSearchTerm
						? section.fields.filter((field) =>
								getFieldSearchText(field, section.group).includes(visibleSearchTerm),
							)
						: section.fields,
					subgroups: section.subgroups
						.map((subgroup) => ({
							...subgroup,
							fields: visibleSearchTerm
								? subgroup.fields.filter((field) =>
										getFieldSearchText(field, subgroup.group).includes(visibleSearchTerm),
									)
								: subgroup.fields,
						}))
						.filter(
							(subgroup) =>
								!visibleSearchTerm ||
								groupMatchesSearch(subgroup.fields, subgroup.group, visibleSearchTerm),
						),
					matches:
						groupMatchesSearch(section.fields, section.group, visibleSearchTerm) ||
						section.subgroups.some((subgroup) =>
							groupMatchesSearch(subgroup.fields, subgroup.group, visibleSearchTerm),
						),
				}))
				.filter((section) => section.matches),
		[groupedSections, visibleSearchTerm],
	);

	const activeSectionItems = useMemo(
		() =>
			matchingSections.map((section) => ({
				id: section.group.id,
				title: section.group.title,
				description: section.group.description,
				countLabel: (() => {
					const count =
						section.fields.length +
						section.subgroups.reduce((total, subgroup) => total + subgroup.fields.length, 0);
					return metadata.features?.showFieldCount ? `${count} fields` : undefined;
				})(),
			})),
		[matchingSections, metadata.features?.showFieldCount],
	);

	useEffect(() => {
		const rootElement = objectRef.current;
		const reportActiveSection = context.editorChrome?.setActiveSection;
		const rootPath = context.editorChrome?.rootPath;
		const isRootEditor = JSON.stringify(rootPath ?? []) === JSON.stringify(path);

		if (!rootElement || !reportActiveSection || !shouldRenderSections || !isRootEditor) return;

		const root = rootElement;
		const setSection: NonNullable<typeof reportActiveSection> = reportActiveSection;
		let animationFrame: number | undefined;
		const scrollContainer = getObjectScrollContainer(root);

		function updateActiveSection() {
			animationFrame = undefined;
			const sections = Array.from(root.querySelectorAll<HTMLElement>(".objectEditor__section"));
			if (sections.length === 0) {
				setSection(undefined);
				return;
			}

			const stickyLine = getActiveSectionLine(root, scrollContainer);
			let activeElement: HTMLElement | undefined;
			const rootRect = root.getBoundingClientRect();

			if (rootRect.top > stickyLine || rootRect.bottom <= stickyLine) {
				setSection(undefined);
				return;
			}

			for (const section of sections) {
				const rect = section.getBoundingClientRect();
				if (rect.top <= stickyLine) {
					activeElement = section;
					if (rect.bottom > stickyLine) break;
				}
			}

			if (!activeElement) {
				setSection(undefined);
				return;
			}

			const activeItem = activeSectionItems.find(
				(item) => item.id === activeElement.dataset.sectionId,
			);
			if (!activeItem) return;

			setSection({
				...activeItem,
				path,
			});
		}

		function scheduleUpdate() {
			if (animationFrame !== undefined) return;
			animationFrame = window.requestAnimationFrame(updateActiveSection);
		}

		updateActiveSection();
		scrollContainer.addEventListener("scroll", scheduleUpdate, {passive: true});
		window.addEventListener("resize", scheduleUpdate);

		return () => {
			if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
			scrollContainer.removeEventListener("scroll", scheduleUpdate);
			window.removeEventListener("resize", scheduleUpdate);
		};
	}, [
		activeSectionItems,
		context.editorChrome?.rootPath,
		context.editorChrome?.setActiveSection,
		path,
		shouldRenderSections,
	]);

	function scrollToSection(groupId: string) {
		document
			.getElementById(`object-section-${path.join("-") || "root"}-${groupId}`)
			?.scrollIntoView({block: "start", behavior: "smooth"});
	}

	function renderFieldGroup(section: (typeof matchingSections)[number]) {
		const allSectionFields = [
			...section.fields,
			...section.subgroups.flatMap((subgroup) => subgroup.fields),
		];
		const groupSummary = allSectionFields
			.map((field) => {
				const fieldValue = value[field.key] ?? field.defaultValue;
				return generateEditorSummary(fieldValue, field.metadata.summary, field.metadata.title);
			})
			.filter(Boolean)
			.slice(0, 3)
			.join(" · ");
		const shouldCollapse =
			!visibleSearchTerm && (section.group.defaultCollapsed || metadata.appearance?.defaultCollapsed);
		const savedOpenState = context.editorChrome?.getSectionDisclosure?.(path, section.group.id);
		const isOpen = Boolean(visibleSearchTerm) || (savedOpenState ?? !shouldCollapse);
		function renderSubgroup(subgroup: (typeof section.subgroups)[number]) {
			const disclosureId = `${section.group.id}/${subgroup.group.id}`;
			const savedSubgroupState = context.editorChrome?.getSectionDisclosure?.(path, disclosureId);
			const subgroupOpen =
				Boolean(visibleSearchTerm) || (savedSubgroupState ?? !subgroup.group.defaultCollapsed);

			return (
				<details
					key={subgroup.group.id}
					className="objectEditor__subgroup universalField--chrome-collapse"
					open={subgroupOpen}
					onToggle={(event) => {
						if (visibleSearchTerm) return;
						context.editorChrome?.setSectionDisclosure?.(path, disclosureId, event.currentTarget.open);
					}}
				>
					<summary className="universalField__cardHeader">
						<div className="universalField__header">
							<div className="universalField__titleRow">
								<div className="universalField__title">{subgroup.group.title}</div>
							</div>
							{subgroup.group.description ? (
								<div className="universalField__description">{subgroup.group.description}</div>
							) : null}
						</div>
					</summary>
					<div
						className={`objectEditor__sectionFields objectEditor__sectionFields--${metadata.features?.layout ?? "stack"}`}
					>
						{subgroup.fields.map((field) =>
							renderField({field, value, onChange, path, disabled, readonly, context}),
						)}
					</div>
				</details>
			);
		}
		const body = (
			<div
				className={[
					"objectEditor__sectionFields",
					`objectEditor__sectionFields--${metadata.features?.layout ?? "stack"}`,
				].join(" ")}
			>
				{section.fields.map((field) =>
					renderField({field, value, onChange, path, disabled, readonly, context}),
				)}
				{section.subgroups.map(renderSubgroup)}
			</div>
		);
		const sectionFieldCount = allSectionFields.length;
		const countLabel = metadata.features?.showFieldCount ? `${sectionFieldCount} fields` : undefined;
		const sectionId = `object-section-${path.join("-") || "root"}-${section.group.id}`;

		return (
			<details
				key={section.group.id}
				id={sectionId}
				data-section-id={section.group.id}
				className={[
					"objectEditor__section",
					"universalField--chrome-collapse",
					`objectEditor__section--${section.group.importance ?? "secondary"}`,
				].join(" ")}
				open={isOpen}
				onToggle={(event) => {
					if (visibleSearchTerm) return;
					context.editorChrome?.setSectionDisclosure?.(path, section.group.id, event.currentTarget.open);
				}}
			>
				<summary className="universalField__cardHeader">
					<div className="universalField__header">
						<div className="universalField__titleRow">
							<div className="universalField__title">{section.group.title}</div>
						</div>
						{countLabel ? (
							<div className="universalField__headerAction">
								<span className="objectEditor__sectionCount">{countLabel}</span>
							</div>
						) : null}
						{section.group.description || groupSummary ? (
							<div className="universalField__description">
								{section.group.description ?? groupSummary}
							</div>
						) : null}
					</div>
				</summary>
				{body}
			</details>
		);
	}

	const content = (
		<div
			className={[
				"objectEditor__fields",
				`objectEditor__fields--${shouldRenderSections ? "section" : (metadata.features?.layout ?? "stack")}`,
			].join(" ")}
		>
			{fields.length > 0 ? (
				shouldRenderSections ? (
					<>
						{matchingSections.map(renderFieldGroup)}
						{ungroupedFields
							.filter((field) =>
								visibleSearchTerm ? getFieldSearchText(field).includes(visibleSearchTerm) : true,
							)
							.map((field) => renderField({field, value, onChange, path, disabled, readonly, context}))}
					</>
				) : (
					fields
						.filter((field) =>
							visibleSearchTerm ? getFieldSearchText(field).includes(visibleSearchTerm) : true,
						)
						.map((field) => renderField({field, value, onChange, path, disabled, readonly, context}))
				)
			) : (
				entries.map(([key, entryValue]) => (
					<div key={key} className="objectEditor__previewRow">
						<span className="objectEditor__previewKey">{key}</span>
						<pre className="objectEditor__previewValue">{formatValue(entryValue)}</pre>
					</div>
				))
			)}

			{fields.length === 0 && entries.length === 0 ? (
				<div className="objectEditor__empty">
					<strong>
						{metadata.features?.emptyTitle ?? metadata.features?.emptyState ?? "Empty object"}
					</strong>
					{metadata.features?.emptyDescription ? (
						<span>{metadata.features.emptyDescription}</span>
					) : null}
					{metadata.features?.defaultValue ? (
						<button
							type="button"
							disabled={!canEdit}
							onClick={() => onChange(metadata.features?.defaultValue ?? {})}
						>
							{metadata.features.emptyActionLabel ?? "Add defaults"}
						</button>
					) : null}
				</div>
			) : null}
			{fields.length > 0 &&
			visibleSearchTerm &&
			matchingSections.length === 0 &&
			ungroupedFields.every((field) => !getFieldSearchText(field).includes(visibleSearchTerm)) ? (
				<div className="objectEditor__empty">
					<strong>No matching fields</strong>
					<span>Try a different field name or section.</span>
				</div>
			) : null}
		</div>
	);

	return (
		<FieldShell
			title={metadata.title}
			description={metadata.description}
			error={error}
			warnings={warnings}
			required={metadata.required}
			disabled={isDisabled}
			readonly={isReadonly}
			appearance={appearance}
			className={metadata.className}
			testId={metadata.testId}
			slots={{
				summary: objectSummary,
				toolbar:
					searchable || metadata.features?.showOutline ? (
						<div className="objectEditor__toolbar">
							{searchable ? (
								<label className="objectEditor__search">
									<span>Search fields</span>
									<input
										type="search"
										value={searchTerm}
										placeholder="Search fields..."
										onChange={(event) => setSearchTerm(event.target.value)}
									/>
								</label>
							) : null}
							{metadata.features?.showOutline && groupedSections.length > 1 ? (
								<nav className="objectEditor__outline" aria-label="Object sections">
									{groupedSections.map((section) => (
										<button
											key={section.group.id}
											type="button"
											onClick={() => scrollToSection(section.group.id)}
										>
											{section.group.title}
										</button>
									))}
								</nav>
							) : null}
						</div>
					) : undefined,
			}}
		>
			<div ref={objectRef} className="objectEditor">
				{metadata.features?.showFieldCount ? (
					<div className="objectEditor__count">{fieldCount} fields</div>
				) : null}
				{content}
			</div>
		</FieldShell>
	);
}

export {isObjectValue};
