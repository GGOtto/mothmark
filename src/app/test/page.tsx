import Link from "next/link";
import "./TestPage.scss";

const CONTROL_TEST_PAGES = [
	{
		href: "/test/text",
		title: "Text Field",
		description: "Short string input controls.",
	},
	{
		href: "/test/textarea",
		title: "Textarea",
		description: "Long-form string editing controls.",
	},
	{
		href: "/test/number",
		title: "Number",
		description: "Numeric editing controls.",
	},
	{
		href: "/test/toggle",
		title: "Toggle",
		description: "Boolean switch, checkbox, and button controls.",
	},
	{
		href: "/test/select",
		title: "Select",
		description: "Single-choice option controls.",
	},
	{
		href: "/test/multi-select",
		title: "Multi-Select",
		description: "Multiple-choice option controls.",
	},
	{
		href: "/test/message",
		title: "Message",
		description: "Read-only editor message controls.",
	},
	{
		href: "/test/tag-list",
		title: "Tag List",
		description: "Compact short string array controls.",
	},
	{
		href: "/test/string-list",
		title: "String List",
		description: "Longer editable string row controls.",
	},
	{
		href: "/test/object",
		title: "Object",
		description: "Nested object editing controls.",
	},
	{
		href: "/test/array",
		title: "Array",
		description: "Repeatable item editing controls.",
	},
	{
		href: "/test/discriminated-union",
		title: "Discriminated Union",
		description: "Branching object controls.",
	},
	{
		href: "/test/entity-picker",
		title: "Entity Picker",
		description: "Registry-backed entity selectors.",
	},
	{
		href: "/test/flag-picker",
		title: "Flag Picker",
		description: "Registry-backed flag selectors.",
	},
	{
		href: "/test/condition-builder",
		title: "Condition Builder",
		description: "Visual condition editing controls.",
	},
	{
		href: "/test/effect-list",
		title: "Effect List",
		description: "Ordered gameplay effect controls.",
	},
	{
		href: "/test/code-preview",
		title: "Code Preview",
		description: "Read-only code and JSON previews.",
	},
	{
		href: "/test/hidden",
		title: "Hidden",
		description: "Explicit non-rendering controls.",
	},
];

export default function UniversalEditorTestPage() {
	return (
		<main className="testPage">
			<section className="testPage__header">
				<p className="testPage__eyebrow">Universal Editor</p>
				<h1 className="testPage__title">Control Test Pages</h1>
				<p className="testPage__description">
					Each page renders one editor control across inherited themes, chrome modes, sizes, validation
					states, disabled and readonly states, and control-specific features.
				</p>
			</section>

			<nav className="testPage__grid" aria-label="Control test pages">
				{CONTROL_TEST_PAGES.map((page) => (
					<Link key={page.href} className="testPage__link" href={page.href}>
						<span className="testPage__linkTitle">{page.title}</span>
						<span className="testPage__linkDescription">{page.description}</span>
					</Link>
				))}
			</nav>
		</main>
	);
}
