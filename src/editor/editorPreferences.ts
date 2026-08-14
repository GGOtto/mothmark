import {z} from "zod";

export const ItemListViewSchema = z.enum(["cards", "rows", "marks", "index"]);
export type ItemListView = z.infer<typeof ItemListViewSchema>;

export const ItemListSortSchema = z.enum([
	"updated-desc",
	"updated-asc",
	"name-asc",
	"name-desc",
	"created-desc",
	"place-asc",
]);
export type ItemListSort = z.infer<typeof ItemListSortSchema>;

export const EditorPreferencesSchema = z.object({
	itemListView: ItemListViewSchema,
	itemListSort: ItemListSortSchema,
});
export type EditorPreferences = z.infer<typeof EditorPreferencesSchema>;

export const DEFAULT_EDITOR_PREFERENCES = {
	itemListView: "cards",
	itemListSort: "updated-desc",
} as const satisfies EditorPreferences;

export const UpdateEditorPreferencesSchema = EditorPreferencesSchema.partial().refine(
	(value) => Object.keys(value).length > 0,
	{message: "At least one editor preference must be provided."},
);

export const ItemActivitySchema = z.object({
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type ItemActivity = z.infer<typeof ItemActivitySchema>;

export const EditorPreferencesResponseSchema = z.object({
	data: z.object({
		preferences: EditorPreferencesSchema,
		itemActivity: z.record(z.string(), ItemActivitySchema).default({}),
	}),
});
