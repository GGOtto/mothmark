# Test coverage findings

This file records product and test-infrastructure bugs confirmed while expanding Jest and Playwright coverage. Every finding below was completed on 2026-08-09, and its executable specification now passes.

## Product bugs

### Browser CSRF parsing crashes on malformed cookie encoding

- **Status:** Complete — 2026-08-09
- **Area:** Editor request security
- **Test:** `src/auth/browserCsrf.test.ts` — “treats a malformed encoded cookie as unavailable instead of crashing the editor”
- **Expected:** A malformed or partially corrupted CSRF cookie is treated as unavailable, allowing the caller to request fresh security state or show its normal request error.
- **Actual:** `readBrowserCsrfToken()` calls `decodeURIComponent()` without handling `URIError`, so reading the cookie throws and can crash client-side request preparation.
- **Suggested fix:** Catch decoding failures and return `undefined`, matching the defensive behavior of the server-side `readCookie()` helper. Add a fresh-token recovery assertion at the request caller if that flow changes.
- **Resolution:** `readBrowserCsrfToken()` now catches malformed URI encoding and returns `undefined`.

### Typed IDs render as `[object Object]` in generated editor identities

- **Status:** Complete — 2026-08-09
- **Area:** Universal editor summaries and copy IDs
- **Tests:** `src/components/universal-editor/utils/universalEditorUtils.test.ts` — “uses readable object labels for deterministic summaries” and “derives copy IDs from typed entity IDs”
- **Expected:** An entity whose `id` is `{type: "room", id: "atrium"}` displays `atrium` and produces `atrium-copy`.
- **Actual:** `generateEditorSummary()` and `createStableId()` pass the nested typed ID through `String()`, yielding `[object Object]` and `object-object-copy`.
- **Suggested fix:** When a candidate label or identity field passes `isID()`, unwrap it with `idValue()` before rendering or transforming it. Keep ordinary primitive `id`, `key`, `name`, and `title` support intact.
- **Resolution:** Summary labels and stable-copy IDs now use the shared typed-ID-aware value formatter.

### Centered selectors emit changes when keyboard navigation cannot move

- **Status:** Complete — 2026-08-09
- **Area:** Shared centered scroll selector
- **Test:** `src/components/ui/CenteredScrollSelector.test.tsx` — “does not emit a redundant change past the lower/upper boundary”
- **Expected:** Arrow Up on the first item and Arrow Down on the last item leave the selection unchanged without invoking `onActiveChange`.
- **Actual:** The calculated index is clamped to the current boundary item, but `centerItem()` is still called and re-emits the active item.
- **Suggested fix:** Return early when the clamped next item has the same ID as `activeId`. Retain `preventDefault()` so the focused selector does not scroll the page.
- **Resolution:** Boundary navigation now returns before centering or emitting `onActiveChange`, while still preventing page scrolling.

### An incomplete password-reset link has no explanation or recovery action

- **Status:** Complete — 2026-08-09
- **Area:** Registered-account recovery UX
- **Test:** `e2e/public-account-ux.spec.ts` — “an incomplete password-reset link explains why it cannot be submitted”
- **Expected:** `/reset-password` without a token explains that the link is incomplete and offers a direct link to request another recovery email.
- **Actual:** The reset button is silently disabled. The page shows no alert and no recovery-specific link, leaving the user without an explanation or next step.
- **Suggested fix:** Initialize the reset form with an incomplete-link error when `token` is empty and render a `/forgot-password` recovery link. Keep the reset submit action disabled until a token is present.
- **Resolution:** Tokenless reset pages now show an alert, link directly to `/forgot-password`, and keep submission disabled.

### Summary lookup recognizes only the first value in multi-operation schema branches

- **Status:** Complete — 2026-08-09
- **Area:** Condition and effect editor summaries
- **Tests:** `src/components/universal-editor/utils/universalEditorSummaryMatrix.test.ts` — the schema-derived effect and condition matrices
- **Expected:** Every operation exposed by the effect and condition schemas produces a useful summary.
- **Actual:** `findEditorSchemaVariant()` compares the selected operation with only the first value returned from an enum field. Later operations sharing the same object branch produce `Unknown effect` or `Unknown condition`. Confirmed examples include item `remove-alias`, `add-tag`, `drop-in-current-room`, `reveal`, `close`, and `empty-into-inventory` effects, plus `false`, `exists`, and `missing` flag conditions for every flag scope.
- **Suggested fix:** Treat a selected discriminator as matching when it is included in all values returned by `getSchemaFieldValues()`, rather than comparing only with `schemaVariantValue()`'s first value. Reuse that membership logic anywhere variants are filtered for operation controls or summaries.
- **Resolution:** Variant lookup and option filtering now match selections against every supported literal or enum value in a schema branch.

### Every item-condition predicate summary serializes its nested test object

- **Status:** Complete — 2026-08-09
- **Area:** Condition editor summaries
- **Test:** `src/components/universal-editor/utils/universalEditorSummaryMatrix.test.ts` — “summarizes every nested item predicate without leaking object serialization”
- **Expected:** Each state, location, behavior, author tag, contents, capacity, unlock, and door predicate produces a readable summary containing its meaningful values.
- **Actual:** The top-level item condition summary stringifies its nested `test` object and displays `[object Object]`. The matrix confirms this for all 43 current item-predicate combinations.
- **Suggested fix:** Detect the item condition's nested predicate schema and summarize that selected nested variant recursively. Keep the implementation schema-driven so new predicate variants are covered automatically.
- **Resolution:** Summary values now recurse through nested schema variants, covering all current item predicates without a type-specific summary catalog.

### Command comparisons stringify counter operands

- **Status:** Complete — 2026-08-09
- **Area:** Command condition summaries
- **Test:** `src/components/universal-editor/utils/universalEditorSummaryMatrix.test.ts` — the literal/counter operand comparison matrix
- **Expected:** Every supported pairing of literal numbers and counter references produces a readable comparison summary.
- **Actual:** Literal-to-literal comparisons render, but any counter operand is displayed as `[object Object]`.
- **Suggested fix:** Format `{source: "counter", counter: "…"}` operands as counter references while preserving the comparison operator and literal-number formatting. Share nested-value formatting with other schema-driven summaries where practical.
- **Resolution:** The recursive schema formatter now renders counter operands from their nested command-number schema.

### Command-variable summaries misrepresent bound fields and expose internal IDs

- **Status:** Complete — 2026-08-09
- **Area:** Command condition and effect summaries
- **Tests:** `src/components/universal-editor/utils/universalEditorSummaryMatrix.test.ts` — the whole-field and inline command-variable summary cases
- **Expected:** A bound value is described as command input rather than as the authored fallback, and inline variables are represented without displaying internal command block IDs.
- **Actual:** Whole-field bindings are ignored, so summaries present fallback strings, numbers, booleans, entities, and directions as unconditional values. Inline value, name, description, and entered-text tokens are printed verbatim, including their internal block IDs.
- **Suggested fix:** Make summary formatting aware of `commandVariables` bindings and serialized inline tokens. Replace bound fields with a generic command-input label or an author-facing catalog label supplied by the editor context; never use the stored block ID in displayed summaries.
- **Resolution:** Whole-field bindings replace fallback values with `command input`, and inline variable tokens are parsed into the same author-facing label without exposing block IDs.

## Test infrastructure bugs

### Jest coverage collection targets paths outside `src`

- **Status:** Complete — 2026-08-09
- **Area:** Coverage reporting
- **Reproduction:** `pnpm exec jest --runInBand --coverage --coverageReporters=text-summary`
- **Expected:** Coverage is collected for application files under `src`.
- **Actual:** All 120 pre-existing suites pass, but the report is `Unknown% (0/0)` because `collectCoverageFrom` targets `app/**`, `components/**`, `types/**`, and `utils/**` at the repository root while the code lives under `src/`.
- **Suggested fix:** Prefix the configured source globs with `src/` and include other maintained source areas (such as `src/auth`, `src/engine`, `src/features`, and schemas) according to the desired coverage policy. Establish thresholds only after a meaningful baseline exists.
- **Resolution:** Jest now collects all maintained TypeScript sources under `src/` while excluding test and declaration files. The verified baseline is 62.03% statements/lines, 75.99% branches, and 63.48% functions.
