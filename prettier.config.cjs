/**
 * Prettier config for Mothmark.
 *
 * Notes:
 * - Active options are uncommented.
 * - Inactive options are commented out with a short explanation.
 * - Prettier intentionally has a small option surface. These are the main official formatting options.
 *
 * Docs:
 * https://prettier.io/docs/options
 *
 * @type {import("prettier").Config}
 */
const config = {
	/**
	 * Max line length before Prettier tries to wrap.
	 * This is not a hard limit; it is a formatting target.
	 */
	printWidth: 100,

	/**
	 * How many columns a tab visually represents.
	 * Since useTabs is true, indentation uses real tabs.
	 */
	tabWidth: 1,

	/**
	 * Use real tab characters for indentation instead of spaces.
	 * This gives us one tab per indent level.
	 */
	useTabs: true,

	/**
	 * Add semicolons at the ends of statements.
	 */
	semi: true,

	/**
	 * Use double quotes instead of single quotes.
	 * false = "like this"
	 * true = 'like this'
	 */
	singleQuote: false,

	/**
	 * Only quote object properties when required.
	 * Options:
	 * - "as-needed": only quote properties when required
	 * - "consistent": if one property needs quotes, quote all properties in that object
	 * - "preserve": keep whatever quoting the object already had
	 */
	// quoteProps: "as-needed",

	/**
	 * Use double quotes in JSX instead of single quotes.
	 * false = <Component name="value" />
	 * true = <Component name='value' />
	 */
	// jsxSingleQuote: false,

	/**
	 * Add trailing commas wherever valid.
	 * Options:
	 * - "all": trailing commas wherever possible
	 * - "es5": trailing commas where valid in ES5, like objects and arrays
	 * - "none": no trailing commas
	 */
	trailingComma: "all",

	/**
	 * Spaces inside object/import braces.
	 * false = import {useState} from "react";
	 * true = import { useState } from "react";
	 *
	 * This also affects object literals:
	 * false = {x: 1}
	 * true = { x: 1 }
	 */
	bracketSpacing: false,

	/**
	 * Put the closing bracket of multiline JSX/HTML/Vue/Angular elements
	 * on the same line as the last prop.
	 *
	 * false:
	 * <Component
	 * 	prop="value"
	 * >
	 *
	 * true:
	 * <Component
	 * 	prop="value">
	 */
	// bracketSameLine: false,

	/**
	 * Include parentheses around a single arrow function parameter.
	 * Options:
	 * - "always": (x) => x
	 * - "avoid": x => x
	 */
	arrowParens: "always",

	/**
	 * Line ending style.
	 * Options:
	 * - "lf": Linux/macOS style; best for most repos
	 * - "crlf": Windows style
	 * - "cr": old classic Mac style
	 * - "auto": preserve existing line endings
	 */
	endOfLine: "lf",

	/**
	 * How to wrap Markdown prose.
	 * Options:
	 * - "always": wrap prose when it exceeds printWidth
	 * - "never": do not wrap prose
	 * - "preserve": preserve existing wrapping when possible
	 */
	// proseWrap: "preserve",

	/**
	 * How whitespace is handled in HTML.
	 * Options:
	 * - "css": respect CSS display behavior
	 * - "strict": whitespace is considered significant everywhere
	 * - "ignore": whitespace is considered insignificant
	 */
	// htmlWhitespaceSensitivity: "css",

	/**
	 * Put each attribute on its own line in HTML, Vue, and JSX.
	 * false keeps attributes packed when they fit.
	 */
	// singleAttributePerLine: false,

	/**
	 * Only format files that already contain a special @prettier or @format comment.
	 * Useful for gradually adopting Prettier in an existing messy codebase.
	 */
	// requirePragma: false,

	/**
	 * Insert an @format marker at the top of formatted files.
	 * Usually not needed unless paired with requirePragma.
	 */
	// insertPragma: false,

	/**
	 * Try Prettier's experimental ternary formatting.
	 * Leave this off unless you specifically want to preview that behavior.
	 */
	// experimentalTernaries: false,

	/**
	 * Parser override.
	 * Usually do not set this globally; Prettier infers the parser from file type.
	 */
	// parser: "typescript",

	/**
	 * Plugin list.
	 * Add this only when using Prettier plugins, like Tailwind class sorting.
	 *
	 * Example:
	 * plugins: ["prettier-plugin-tailwindcss"],
	 */
	// plugins: [],

	/**
	 * Per-file overrides.
	 * Use this when certain file types should format differently.
	 */
	overrides: [
		/**
		 * Markdown is less cursed with spaces, especially for nested lists/code blocks.
		 */
		{
			files: ["*.md", "*.mdx"],
			options: {
				useTabs: false,
				tabWidth: 2,
				proseWrap: "preserve",
			},
		},

		/**
		 * YAML conventionally uses spaces.
		 */
		{
			files: ["*.yml", "*.yaml"],
			options: {
				useTabs: false,
				tabWidth: 2,
			},
		},

		/**
		 * JSON with tabs is allowed by Prettier, so keep this commented unless
		 * you decide JSON should use spaces for compatibility/readability.
		 */
		// {
		// 	files: ["*.json"],
		// 	options: {
		// 		useTabs: false,
		// 		tabWidth: 2,
		// 	},
		// },
	],
};

module.exports = config;
