"use client";

import {useMemo, useState} from "react";
import {z} from "zod";
import {WorldSchema} from "../../schemas/worldSchema";

type CreateDefaultJsonOptions = {
	includeOptionalFields?: boolean;
	arrayItems?: number;
};

type ZodSchema = z.ZodTypeAny;

export default function StarterWorldPage() {
	const [hasCopied, setHasCopied] = useState(false);

	const starterWorldJson = useMemo(() => {
		const starterWorld = createDefaultJson(WorldSchema, {
			arrayItems: 1,
		});

		return JSON.stringify(starterWorld, null, 2);
	}, []);

	async function copyJson() {
		await navigator.clipboard.writeText(starterWorldJson);
		setHasCopied(true);

		window.setTimeout(() => {
			setHasCopied(false);
		}, 1200);
	}

	return (
		<main className="min-h-full bg-zinc-950 px-8 py-8 text-zinc-100">
			<div className="mx-auto flex max-w-5xl flex-col gap-6">
				<header>
					<h1 className="text-2xl font-bold">Starter World</h1>
					<p className="mt-2 max-w-2xl text-sm text-zinc-400">
						Copy this generated JSON and fill it out to create a new Mothmark world.
					</p>
				</header>

				<section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-lg">
					<div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-3">
						<h2 className="text-sm font-semibold text-zinc-100">Starter world JSON</h2>

						<button
							type="button"
							onClick={copyJson}
							className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
						>
							{hasCopied ? "Copied!" : "Copy"}
						</button>
					</div>

					<pre className="max-h-[70vh] overflow-auto p-4 text-sm leading-6 text-zinc-100">
						<code>{starterWorldJson}</code>
					</pre>
				</section>
			</div>
		</main>
	);
}

function createDefaultJson<T extends ZodSchema>(
	schema: T,
	options: CreateDefaultJsonOptions = {},
): z.infer<T> {
	const resolvedOptions: Required<CreateDefaultJsonOptions> = {
		includeOptionalFields: true,
		arrayItems: 0,
		...options,
	};

	return createDefaultValue(schema, resolvedOptions) as z.infer<T>;
}

function createDefaultValue(
	schema: ZodSchema,
	options: Required<CreateDefaultJsonOptions>,
): unknown {
	const def = schema._def as {
		type?: string;
		[key: string]: unknown;
	};

	switch (def.type) {
		case "default": {
			const defaultValue = def.defaultValue;

			if (typeof defaultValue === "function") {
				return defaultValue();
			}

			return defaultValue;
		}

		case "optional": {
			if (!options.includeOptionalFields) return undefined;

			const innerType = def.innerType as ZodSchema;
			return createDefaultValue(innerType, options);
		}

		case "nullable": {
			return null;
		}

		case "object": {
			const shapeGetter = def.shape;
			const shape =
				typeof shapeGetter === "function"
					? (shapeGetter as () => Record<string, ZodSchema>)()
					: (shapeGetter as Record<string, ZodSchema>);

			const result: Record<string, unknown> = {};

			for (const key in shape) {
				const value = createDefaultValue(shape[key], options);

				if (value !== undefined || options.includeOptionalFields) {
					result[key] = value;
				}
			}

			return result;
		}

		case "array": {
			const element = def.element as ZodSchema;

			return Array.from({length: options.arrayItems}, () => createDefaultValue(element, options));
		}

		case "string": {
			return "";
		}

		case "number": {
			return 0;
		}

		case "boolean": {
			return false;
		}

		case "enum": {
			const entries = def.entries as Record<string, string | number> | undefined;

			if (entries) {
				return Object.values(entries)[0];
			}

			return "";
		}

		case "literal": {
			const values = def.values as unknown[] | Set<unknown> | undefined;

			if (values instanceof Set) {
				return Array.from(values)[0];
			}

			if (Array.isArray(values)) {
				return values[0];
			}

			return null;
		}

		case "union": {
			const optionsList = def.options as ZodSchema[];
			return createDefaultValue(optionsList[0], options);
		}

		case "record": {
			return {};
		}

		case "pipe": {
			const innerType = def.in as ZodSchema;
			return createDefaultValue(innerType, options);
		}

		case "transform": {
			return null;
		}

		case "date": {
			return new Date().toISOString();
		}

		case "unknown":
		case "any": {
			return null;
		}

		default: {
			return null;
		}
	}
}
