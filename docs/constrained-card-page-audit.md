# Constrained card and scrolling page audit

Status: inventory only. No layout changes have been designed or implemented.

Last audited: 2026-08-09.

## Why these surfaces are grouped

This audit covers production pages and editor views that present their main content as a centered,
width-constrained card, table frame, card grid, or similar surface inside a larger available canvas.
The common symptoms are:

- the main surface uses substantially less horizontal space than its container;
- information-dense content feels compressed even when more workspace is available;
- the page header, search, filters, or primary controls share the content's scroll container and can
  disappear while the user scrolls; or
- the view uses the same constrained-card composition even when its header is already outside the
  scrolling region.

`/account`, `/privacy`, and the editor's World settings view are explicitly in scope. This means the
inventory includes centered single-card pages as well as list and catalog pages.

The audit found **25 production surfaces**: 19 routable pages and 6 editor views.

## Routable pages in scope

### Primary application pages

| Route      | Surface                                         | Width constraint | Scroll and header behavior                                                                                                                                                                                            | Source                                                  |
| ---------- | ----------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `/`        | Home introduction card                          | `576px`          | The card is centered in the viewport. It normally does not scroll, but it uses the same narrow single-card composition.                                                                                               | `src/app/page.tsx`, `src/app/page.scss`                 |
| `/worlds`  | World library, including Worlds and Trash views | `820px`          | `.worldsPage` owns vertical scrolling. The library header and view controls are in that scroll flow and are not sticky.                                                                                               | `src/app/worlds/page.tsx`, `src/app/worlds/page.scss`   |
| `/account` | Account and security card                       | `560px`          | `.accountPage` owns vertical scrolling. The title and account controls are inside the card and scroll away with long registered-account content.                                                                      | `src/app/account/page.tsx`, `src/app/account/page.scss` |
| `/privacy` | Privacy notice card                             | `560px`          | Reuses the account page and card classes. The whole card participates in the page scroll.                                                                                                                             | `src/app/privacy/page.tsx`, `src/app/account/page.scss` |
| `/starter` | Starter-world JSON card                         | `1024px`         | The page is constrained, but the large JSON block has its own `70vh` internal scroll. The page header usually remains visible while the JSON scrolls. It still has the same constrained header-plus-card composition. | `src/app/starter/page.tsx`, `src/app/starter/page.scss` |
| `/play`    | Published-world catalog                         | `1040px`         | `.playCatalogPage` owns vertical scrolling. The title and search are in the same scroll flow as the card grid and are not sticky.                                                                                     | `src/app/play/page.tsx`, `src/app/play/play.scss`       |

### Account entry pages

All five routes render the same `AuthShell`. The card is capped at `460px`, and `.authPage` owns
vertical scrolling. These pages are less information-dense than catalogs, so the eventual layout may
remain narrower, but they match the expanded structural definition and should be considered rather
than silently omitted.

| Route              | Surface                   |
| ------------------ | ------------------------- |
| `/sign-in`         | Sign-in form              |
| `/register`        | Account registration form |
| `/forgot-password` | Account recovery request  |
| `/reset-password`  | Password reset form       |
| `/verify-email`    | Email verification result |

Source: `src/components/auth/AccountAuthForm.tsx` and
`src/components/auth/AccountAuthForm.scss`.

### Administration pages

The administration shell puts all page content inside `.adminContent`, which owns vertical scrolling.
Every oversight page uses `.adminPage`, capped at `1180px`. `.adminPageHeader` is static, so page
headers scroll away with long tables and detail sections. Table frames and `.adminSection` panels are
the content cards.

| Route                      | Surface                    | Content after the header                                                                              |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/admin/users`             | User oversight list        | One bordered table frame                                                                              |
| `/admin/users/[id]`        | User detail                | Multiple metadata, controls, worlds, sessions, and permissions cards                                  |
| `/admin/worlds`            | World oversight list       | One bordered table frame                                                                              |
| `/admin/worlds/[id]`       | World detail               | Metadata, controls, and world-document cards                                                          |
| `/admin/publications`      | Publication oversight list | One bordered table frame                                                                              |
| `/admin/publications/[id]` | Publication detail         | Constrained detail content; it uses `adminDetailSection` rather than the standard `adminSection` card |
| `/admin/audit`             | Audit history              | Filters card followed by an events/table card                                                         |

Source: `src/app/admin/admin.scss` and the pages under
`src/app/admin/(oversight)/`.

The administrator sign-in route is also in scope as a constrained single-card page:

| Route            | Surface                                        | Width constraint | Scroll behavior                                                                        |
| ---------------- | ---------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------- |
| `/admin/sign-in` | Administrator password and second-factor forms | `440px`          | `.adminSignIn` owns vertical scrolling; all headings and controls are inside the card. |

Source: `src/app/admin/sign-in/page.tsx` and `src/app/admin/admin.scss`.

## Editor views in scope

The canonical editor route is `/worlds/[editorSlug]`. The legacy `/editor` route family renders the
same editor and is not a separate surface for this inventory.

| Editor view    | Surface                                                   | Width constraint | Scroll and header behavior                                                                                                                       | Source                                                                                                  |
| -------------- | --------------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| Items          | Header, search, and bordered item table                   | `980px`          | `.itemCatalog` owns the scroll. The page title, Add item button, and search all scroll away with the item rows.                                  | `src/components/studio/ItemCatalog.tsx`, `src/app/editor/page.scss`                                     |
| NPCs / Story   | Placeholder content card                                  | `576px`          | `.placeholderWorkspace` owns any overflow. The 48px editor toolbar is outside that scroller and is already pinned structurally.                  | `src/app/editor/page.tsx`, `src/app/editor/page.scss`                                                   |
| Debug / Issues | Placeholder content card                                  | `576px`          | Same shared placeholder composition as NPCs / Story.                                                                                             | `src/app/editor/page.tsx`, `src/app/editor/page.scss`                                                   |
| World settings | Reset and publishing content inside a single card         | `576px`          | The card is narrow relative to the workspace and `.placeholderWorkspace` owns its overflow. The editor toolbar is already outside that scroller. | `src/app/editor/page.tsx`, `src/app/editor/page.scss`, `src/components/publication/PublishingPanel.tsx` |
| Settings       | Placeholder content card                                  | `576px`          | Same shared placeholder composition.                                                                                                             | `src/app/editor/page.tsx`, `src/app/editor/page.scss`                                                   |
| Logic overview | Heading followed by a two-column grid of navigation cards | `680px`          | The overview is centered and does not currently own a scroll region, but it leaves substantial workspace unused.                                 | `src/components/logic/shared/LogicWorkspace.tsx`, `src/components/logic/shared/LogicWorkspace.scss`     |

World settings was measured in the running app at a `1920px` viewport: the editor workspace was
`1180px` wide while the card remained `576px` wide. NPCs / Story, Debug / Issues, and Settings use
the exact same `PlaceholderWorkspace` and `placeholderWorkspaceCard` implementation.

## Observed examples of the problem

These measurements are from the running development app and are included to make the audit
reproducible:

- **Items:** at a `1920px` viewport, the available editor workspace was `1180px` wide while the
  header, search, and table remained `980px` wide. The item scroller was `571px` tall with `1630px`
  of content. Scrolling it by `700px` moved the header from `y=124` to `y=-576` and the search from
  `y=233.5` to `y=-466.5`.
- **World library:** at a `1920px` viewport, the page was `1920px` wide while the library remained
  `820px` wide. In a short viewport, scrolling the library page moved the header with the content,
  confirming that it is not pinned.
- **World settings:** at a `1920px` viewport, the workspace was `1180px` wide while the card remained
  `576px` wide. Its toolbar stayed outside the scrolling content, so only the width problem is shared.
- **Published worlds:** the header, search, result status, and card grid are all capped at `1040px`
  inside the full-width `.playCatalogPage` scroller.

## Similar surfaces that are not in scope

These were inspected so they do not need to be rediscovered during implementation.

| Surface                                         | Why it does not count                                                                                                                                 |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosted player at `/play/[slug]`                 | It is a full-height terminal with a fixed-height header outside the terminal scroll. It does not use a centered content card.                         |
| Editor Map view                                 | The map deliberately fills the available workspace and owns its controls.                                                                             |
| Logic Events editor                             | It uses a full-height rail-and-tree layout. Its branch toolbar is already sticky inside the tree scroller.                                            |
| Logic Commands library                          | It fills the workspace. Search and New command controls are outside the independently scrolling command list; this is a useful reference composition. |
| Command and behavior editors                    | These are dedicated full-height workspaces with scoped internal scrolling and pinned toolbars, not page-header-plus-card layouts.                     |
| Logic Conditions and Effects placeholders       | They use the minimal `logicEmpty` message and Back button, not a card or catalog surface.                                                             |
| Dialogs, popups, entity pickers, and inspectors | They are transient layers or side panels rather than pages or primary editor views.                                                                   |
| `/admin`                                        | Redirects to `/admin/users`; it has no unique page surface.                                                                                           |
| `/editor` and `/editor/[worldId]`               | Legacy aliases for the canonical private-world editor; they do not add distinct layouts.                                                              |
| Routes under `/test/*`                          | Internal component harnesses. Their intentionally constrained cards and matrices are not production pages.                                            |

## Shared implementation clusters for a future fix

No implementation is proposed here, but the inventory falls into a few existing clusters that should
be evaluated together:

1. **Catalog and library pages:** Items, Worlds, Published worlds, and the three admin list pages.
2. **Long detail pages:** Account, Privacy, admin detail pages, and Audit history.
3. **Editor constrained cards:** World settings and the shared NPCs, Debug, and Settings placeholder
   views, plus the Logic overview.
4. **Short single-card pages:** Home, account-entry routes, and administrator sign-in.
5. **Special case:** Starter world, whose large content already scrolls inside its card.

The groups may need different final widths, but all should be reviewed when introducing a common
full-space content shell or pinned page-header convention.
