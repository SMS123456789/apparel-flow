# 15 - ApparelFlow UI design system

**UX00 — UI Design Contract.** This is the required visual and interaction
contract for all future ApparelFlow frontend/UI work. Read it before implementing
or changing any page or component. Overrides require explicit human approval.

**Scope:** UX00 is documentation only. It creates this contract and the root
[AGENTS.md](../AGENTS.md) instruction. Do not implement pages, components, CSS,
tokens in code, or dependencies during UX00. Stop after documentation.

The visual choices here are implementation design decisions within the approved
light, desktop-first direction. Business behavior remains governed by
[01 Requirements](01_REQUIREMENTS.md), [02 Business rules](02_BUSINESS_RULES.md),
[03 Roles and permissions](03_ROLES_AND_PERMISSIONS.md),
[04 State machine](04_STATE_MACHINE.md), [09 UI/UX](09_UI_UX_SPEC.md), and
[10 Admin panel](10_ADMIN_PANEL_SPEC.md). This contract refines their presentation;
it does not add manufacturing gates, roles, analytics, or workflow states. Read
[12 Engineering rules](12_CODEX_ENGINEERING_RULES.md) for implementation boundaries.

## Product character

ApparelFlow is an industrial garment-production ERP terminal. It must feel
operational, precise, professional, calm, trustworthy, and efficient. Aim for a
factory workstation with modern enterprise operations software: information-dense
without clutter, readable through a full working day, and predictable under time
pressure.

It must not resemble a startup landing page, crypto dashboard, generic
AI-generated SaaS dashboard, marketing website, or playful consumer application.
Operational tasks determine the content and hierarchy of each screen.

Use a light neutral application background, white primary work surfaces, dark
legible typography, restrained borders, one blue brand/accent family, and
green/yellow/red reserved for operational meaning. Prefer tables, compact forms,
clear section headings, relatively square controls, and minimal shadows. Dark
mode is outside the initial requirement.

## Anti-AI-slop rules

The following are prohibited:

- Decorative gradients, glassmorphism, glowing elements, and unnecessary blur.
- Giant hero typography and huge empty whitespace.
- Cards nested inside cards or every section placed inside a separate card.
- Excessive rounded containers and rounding every element into a pill.
- Random colorful icons and excessive shadows.
- Generic statistics cards without operational value and meaningless KPIs.
- Fake charts, fake analytics, invented factory statistics, and lorem ipsum.
- Decorative illustrations and random stock imagery.
- Excessive animation, bouncing elements, floating motion, and hover transforms.
- Excessive badges and excessive accent-color use.
- Unnecessary dashboard widgets invented by AI.

Do not invent data merely because a dashboard looks empty. Empty, loading,
unavailable, and zero are distinct states. Use real authorized data, approved
recipe requirements, and useful empty-state text. Never present mock or seed
values as live production results. Charts need a later explicit business
requirement, a real data source, and an operational decision they support.

Imagery is not a layout filler. A supplied component reference image may appear
only when it helps identify a real component, with its name and an accessible
fallback. No generated decorative imagery is needed for these workflows.

## Color tokens

These are the canonical initial light-theme values. Token names below are a
contract for future implementation, not a request to edit styles during UX00.
Consume shared tokens rather than introducing page-specific hex colors.

| Token                    | Value                    | Purpose                                                             |
| ------------------------ | ------------------------ | ------------------------------------------------------------------- |
| `--af-bg-app`            | `#F3F4F6`                | Neutral application background and restrained sidebar.              |
| `--af-surface`           | `#FFFFFF`                | Main work surface, fields, and table body.                          |
| `--af-surface-elevated`  | `#FFFFFF`                | Dialogs, drawers, and menus; elevation comes from placement/border. |
| `--af-text-primary`      | `#111827`                | Body, headings, input values, and dropdown options.                 |
| `--af-text-secondary`    | `#374151`                | Supporting values and navigation.                                   |
| `--af-text-subtle`       | `#4B5563`                | Helper text, placeholders, timestamps; still readable.              |
| `--af-border`            | `#D1D5DB`                | Structural dividers and table separators.                           |
| `--af-border-control`    | `#6B7280`                | Field and outlined-button boundaries needed to identify controls.   |
| `--af-primary`           | `#1E40AF`                | Primary action, meaningful links, active navigation marker.         |
| `--af-primary-hover`     | `#1E3A8A`                | Primary action hover/pressed state.                                 |
| `--af-on-primary`        | `#FFFFFF`                | Text/icons on primary actions.                                      |
| `--af-destructive-hover` | `#7F1D1D`                | Hover/pressed background for filled destructive actions.            |
| `--af-hover-bg`          | `#F3F4F6`                | Neutral row, option, and secondary-action hover.                    |
| `--af-pressed-bg`        | `#E5E7EB`                | Neutral pressed state.                                              |
| `--af-selected-bg`       | `#EFF6FF`                | Restrained selected-option/navigation background.                   |
| `--af-focus`             | `#1D4ED8`                | Visible control outline and focused border.                         |
| `--af-disabled-bg`       | `#E5E7EB`                | Unavailable controls.                                               |
| `--af-disabled-text`     | `#4B5563`                | Legible disabled values and action labels.                          |
| `--af-disabled-border`   | `#6B7280`                | Identifiable disabled-control boundary.                             |
| `--af-overlay`           | `rgba(17, 24, 39, 0.40)` | Modal backdrop only; no backdrop blur.                              |

The pale structural border is not sufficient for identifying an input or an
outlined button. Use `--af-border-control` for those boundaries. Never apply
opacity to an entire disabled control: it would dilute both text and background.

| Operational meaning | Text/icon token               | Background token            | Border token                    | Required label                                     |
| ------------------- | ----------------------------- | --------------------------- | ------------------------------- | -------------------------------------------------- |
| GREEN / MATCH       | `--af-match-text: #166534`    | `--af-match-bg: #F0FDF4`    | `--af-match-border: #15803D`    | Check icon + **Match**.                            |
| YELLOW / EXCESS     | `--af-excess-text: #854D0E`   | `--af-excess-bg: #FFFBEB`   | `--af-excess-border: #A16207`   | Triangle icon + **Excess** and signed surplus.     |
| RED / SHORTAGE      | `--af-shortage-text: #991B1B` | `--af-shortage-bg: #FEF2F2` | `--af-shortage-border: #B91C1C` | Exclamation icon + **Shortage** and missing count. |

Yellow is rendered as dark amber text on a pale background, never bright yellow
text on white. Color must never be the only indicator. Use one consistent icon
family, normally monochrome 16px icons; apply semantic color only when the icon
communicates that status. Decorative icons are hidden from assistive technology;
the adjacent label provides the meaning.

Use the red family for invalid fields and destructive actions, with explicit
error/action wording. Destructive filled buttons use `--af-shortage-text` with
white text and `--af-destructive-hover` for hover. Warning-only fabric
cap messages may use amber; they must explicitly say they do not block approval.
Workflow labels such as Pending verification, Rejected, Verified, and Started
must remain distinct from component Match/Excess/Shortage. Never use a component
traffic light to imply a different production state.

### Mandatory contrast contract

The assessment input-contrast requirement (REQ-020 and UI-03) is mandatory.
Input values, placeholders, search text, dropdown options, selected options,
focus states, disabled states, and validation messages must remain readable.
Specify text and background together; do not trust inherited defaults.

Use at least 4.5:1 for normal text, including placeholders. WCAG permits 3:1 for
qualifying large text; this system retains 4.5:1 for its compact UI typography.
ApparelFlow also requires 4.5:1 for disabled text even though inactive controls
have a WCAG exception. See [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

Control boundaries and meaningful non-text indicators must achieve at least 3:1
against adjacent backgrounds where needed to identify the control or state.
Apply that target to the visible focus outline as a project rule. See
[W3C non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

| Specified pair                             | Contrast, approximately |
| ------------------------------------------ | ----------------------- |
| Primary text / white surface               | 17.74:1                 |
| Secondary text / white surface             | 10.31:1                 |
| Subtle or placeholder text / white surface | 7.56:1                  |
| White text / blue primary action           | 8.72:1                  |
| Disabled text / disabled background        | 6.10:1                  |
| Match text / match background              | 6.81:1                  |
| Excess text / excess background            | 6.61:1                  |
| Shortage text / shortage background        | 7.60:1                  |
| Control border / white surface             | 4.83:1                  |
| Focus outline / app background             | 6.09:1                  |

These ratios are calculated from the specified sRGB values; they do not prove
contrast in an implemented page. Future reviews must measure computed colors in
default, hover, selected, focus, invalid, read-only, disabled, loading, and browser
autofill states. Check portaled menus as well as their triggers. Fix failing
combinations rather than removing important text or labels.

## Spacing, density, and geometry

Use a 4px base grid. Values are CSS-pixel equivalents; preserve browser zoom and
text resizing. Choose spacing by purpose and reuse it across workspaces.

| Spacing token  | Value | Typical use                                       |
| -------------- | ----- | ------------------------------------------------- |
| `--af-space-1` | 4px   | Icon/text separation and label-to-field gap.      |
| `--af-space-2` | 8px   | Related actions and field-to-message gap.         |
| `--af-space-3` | 12px  | Table horizontal cell padding and compact groups. |
| `--af-space-4` | 16px  | Form row gap, surface inset, mobile page padding. |
| `--af-space-5` | 20px  | Medium separation when 16px is insufficient.      |
| `--af-space-6` | 24px  | Desktop page padding and section separation.      |
| `--af-space-8` | 32px  | Major task-group separation, used sparingly.      |

Default field groups are 16px apart; section groups are 24px apart. Whitespace
supports grouping, reading, and safe action separation. Do not add large gaps to
make a sparse page appear designed.

| Geometry token                | Value                               | Rule                                                         |
| ----------------------------- | ----------------------------------- | ------------------------------------------------------------ |
| `--af-radius-control`         | 4px                                 | Buttons, inputs, tabs, small indicators.                     |
| `--af-radius-surface`         | 6px                                 | A bounded work region when useful.                           |
| `--af-radius-dialog`          | 8px                                 | Dialog and drawer corners only.                              |
| `--af-control-height`         | 36px minimum                        | Standard desktop button, input, select.                      |
| `--af-verifier-input-height`  | 40px minimum                        | Actual-count entry with 16px text.                           |
| `--af-touch-control-height`   | 44px minimum                        | Coarse-pointer and narrow-screen controls.                   |
| `--af-table-row-height`       | 40px minimum                        | Ordinary data rows; grow for wrapping.                       |
| `--af-table-entry-row-height` | 48px minimum                        | Desktop rows containing count inputs/actions.                |
| `--af-shadow-flat`            | none                                | Shell, pages, forms, tables, buttons.                        |
| `--af-shadow-overlay`         | `0 4px 12px rgba(17, 24, 39, 0.12)` | One restrained shadow for menus/dialogs/drawers when needed. |

Heights are minimums, never clipping constraints. Do not introduce pill-shaped
containers, circular icon backplates, or a shadow on every section. Status text
usually needs only an icon and label; if a bounded indicator helps scanning, use
the small radius and compact padding.

## Typography

Use one coherent sans-serif UI family: Arial, with the fallback stack
`Arial, "Helvetica Neue", Helvetica, sans-serif`. This system-font choice needs
no network font download. Do not mix display, geometric, and body font families.

| Role                   | Size / line height | Weight | Use                                              |
| ---------------------- | ------------------ | ------ | ------------------------------------------------ |
| Page title             | 24px / 32px        | 600    | One clear page heading.                          |
| Section heading        | 16px / 24px        | 600    | Task groups and table sections.                  |
| Body                   | 14px / 20px        | 400    | Operational content and navigation.              |
| Label                  | 13px / 20px        | 600    | Persistent form labels and table headers.        |
| Helper text            | 12px / 16px        | 400    | Useful instructions, units, timestamps.          |
| Table text             | 14px / 20px        | 400    | Data cells; do not shrink to fit more columns.   |
| Numeric/count emphasis | 16px / 24px        | 600    | Target, expected, actual, and meaningful totals. |

Use tabular numerals where supported for counts and variances. Align numeric
columns to the right and use consistent precision/units from the business
contract. Preserve signed variances; do not silently clamp or round user input.
Order IDs and counts do not require a separate monospace font. Avoid gigantic
headings, all-caps paragraphs, wide tracking, and oversized KPI numbers.

## Application shell and page hierarchy

Desktop is the primary operational target. Use a persistent shell with a compact
48px-minimum top bar and, when navigation warrants it, a restrained approximately
208px sidebar. The top bar identifies the application, authenticated user/role,
and sign-out. Limit sidebar links to the current role's authorized workspace.

Place the page title, short context if necessary, and contextual page actions at
the top of the work area. Use at most one visually dominant primary action for
the current task. Follow with filters/task controls and the main table or form.
Use the available width for tables; compact forms can use an approximately 720px
content region. Let the top bar and action row grow when content wraps.

Organize sections with headings, alignment, spacing, and dividers on a shared
work surface. A bounded panel must express a useful task boundary, not simply
decorate every section. Never nest cards. Split panes are appropriate when a
verifier must compare order/recipe context with counts; stack them when width is
insufficient. Keep task order and reading order consistent.

## Component rules

All components share the tokens, geometry, typography, and density above.
Every interactive component needs default, hover, focus, unavailable, and loading
behavior where relevant. Labels describe the action concretely: Save Counts,
Submit for verification, Approve, Reject, and Start Sewing Assembly.

### Buttons

| Hierarchy   | Appearance                                                                                            | Use                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Primary     | Blue fill, white text; darker blue hover.                                                             | The main next action, subject to workflow eligibility.                  |
| Secondary   | White fill, dark text, control border; neutral hover.                                                 | Related actions such as Save Counts when Approve is primary, or Cancel. |
| Destructive | Red text/control boundary for entry; red fill with white text for the final destructive confirmation. | Reject, deactivate, or discard with explicit wording.                   |
| Ghost/text  | No persistent container; dark or blue text, neutral hover, visible focus.                             | Lower-priority navigation or row actions where justified.               |

These are four hierarchy roles, not permission to invent competing styles for
every page. Keep destructive actions apart from the primary action with spacing
and explicit labels. Do not color Approve green merely to add a fifth style.
Never make an action available only on hover. Icon-only controls need an
accessible name and enough target area; use text for consequential actions.

Loading replaces the action label with a precise state such as Saving counts…
and prevents repeat submission. Unavailable actions use the disabled tokens and
a visible reason near the action, not a tooltip that cannot be reached. Use
native disabled semantics or correctly enforced `aria-disabled` semantics; an
unavailable-looking control must not still submit through pointer or keyboard.

### Inputs, selects, and textareas

Use white backgrounds, dark input text, subtle readable placeholders, control
borders, and persistent labels. On focus, use the blue border and a visible 2px
outline with 2px separation from the control, so it is distinguishable from a
filled button. Do not remove the outline without an equally visible replacement.

Invalid fields use a red border plus inline text; keep the focus outline visible
when invalid and focused. Read-only values stay dark, selectable, and clearly
identified as read-only. Disabled values remain readable using explicit tokens.

Select triggers and every option, including portaled options, have explicit
background/text colors. Hover uses the neutral background; selection uses the
pale blue background with dark/blue text plus a selection indicator. Support
keyboard selection and escape/close behavior through accessible primitives.
Do not use white text on pale selected options or hide labels after selection.

Textareas use the same states, start at approximately three readable lines, and
allow vertical growth. A rejection reason shows its required status and 1000
character limit; do not enlarge every short field into a tall form block.

### Tables

Tables are a primary ERP pattern. Use semantic headers, clear column names,
restrained row separators, a neutral header background, and consistent cell
padding. Use the row-height minimums above and wrap meaningful long names. Sticky
headers are useful for long lists only when they do not obscure focused content.

Left-align identities/names, right-align counts/quantities/signed variances, and
group actions consistently at the row end. Put units in headers or labels. Keep
actual inputs aligned with their expected count and result. Show missing values
explicitly; a blank actual count is Not counted, never a default zero.

Do not add fake columns, meaningless ranks, redundant badges, or decorative
progress bars. A normal 1280px desktop review must not require horizontal
scrolling unless the actual information demands it. Reduce redundant columns or
move secondary evidence to detail before widening a table. Do not hide essential
counts, status, identity, or actions to make a table fit.

### Other shared components

| Component            | Required behavior and visual treatment                                                                                                                                                                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status indicators    | Icon + explicit text; optional compact semantic tint. Include signed excess/missing quantity where useful. Not counted and Incomplete data are explicit blocking labels.                                                                                          |
| Dialogs              | White surface, restrained border/radius, title, purpose, close/cancel action, and clearly named confirmation. Provide accessible name/description, focus containment, keyboard close when safe, and return focus to the trigger.                                  |
| Drawers              | Task-related supporting detail or collapsed navigation. No decorative floating panels. A modal drawer follows dialog focus rules; a nonmodal pane preserves normal document keyboard order.                                                                       |
| Tabs                 | Compact text labels, visible selected underline/marker, explicit selected state, and keyboard operation. Use for related views, not hidden workflow stages or invented analytics.                                                                                 |
| Alerts               | Explain a real consequence and useful next action. Neutral/blue for information, amber for warnings, red for errors; icon/text convey meaning. No stack of decorative banners.                                                                                    |
| Empty states         | Plain task-specific heading and concise explanation; authorized next action only when useful. Distinguish no records from no filter results. No illustration, invented totals, or placeholder chart.                                                              |
| Pagination           | Compact Previous/Next and actual page/range information supported by the API. Disable unavailable directions legibly. Search, counts, and page changes retain the authorized role scope.                                                                          |
| Navigation           | Persistent location label, active marker plus text, semantic links, visible focus, and mobile menu control. Never rely on icon color alone. Hiding links does not authorize backend access.                                                                       |
| Form errors          | Inline message associated with its field; identify what failed and how to fix it. On submit, use an error summary/focus destination when multiple fields fail. Keep entered data where recovery is safe.                                                          |
| Confirmation prompts | Name the order/user, consequential action, and effect; offer explicit Cancel and action label. Confirm irreversible sign-off, rejection, submission freeze, deactivation, and discarding unsaved edits; do not add prompts to ordinary navigation or Save Counts. |
| Loading states       | Simple text/spinner or static skeleton matching the eventual structure. Announce loading/saving accessibly and prevent duplicate writes. Never fill skeletons with fake values or use animated shimmer/large motion.                                              |

Only subtle color/opacity transitions of approximately 100-150ms are appropriate
when they help communicate state. No movement, bouncing, or scale transforms.
Respect reduced-motion preferences; a static loading label is always sufficient.

## Operational forms

- Use visible persistent labels; placeholders provide examples, never labels.
- Mark required fields in visible text or with an explained marker and expose the
  required state programmatically. Show units such as yards in the label.
- Validate inline with useful messages; associate helper/error text with the
  field and expose invalid state. Helpers appear only when they explain a choice,
  unit, limit, or consequence.
- Keep a logical keyboard sequence and clear focus. Never make Enter in a count
  field accidentally approve an order.
- Show explicit Unsaved, Saving, Saved, or Error state; success follows the
  committed backend response. Distinguish saving a form from submitting a batch.
- Separate destructive actions from save/submit controls. Preserve recoverable
  edits after an error and warn before discarding unsaved work.

Numeric verifier fields use 16px text, at least 40px height on desktop and 44px
for touch, and enough width for the full supported count. They should support
rapid entry without appearing as oversized hero numbers. Use a suitable numeric
input mode without hiding business validation. Actual counts are nonnegative
integers; target quantities are positive integers. Blank is uncounted, while
explicit zero is a count. Actual fabric accepts positive yards to at most three
decimal places. Do not coerce empty input to zero or silently round invalid input.

## Cutting Verifier terminal

This is the most important operational screen. Its scan hierarchy is:

1. Order identity.
2. Recipe.
3. Target quantity.
4. Component name.
5. Expected count.
6. Actual-count entry.
7. Match/excess/shortage result.
8. Overall eligibility.
9. Reject/Approve actions.

Keep order/recipe/target together in a compact identity header. Show the current
attempt and fabric basis as supporting context. The main work region is the
component table: Component, Expected, Actual, Variance, Result. Keep Save Counts
and its save-state label near the entries. Place the overall eligibility reason
beside the decision actions in the main work area, not in a decorative widget.

Use immediate local feedback for scanning; label unsaved feedback appropriately.
Show Match, Excess with a signed surplus, Shortage with the missing quantity,
Not counted, and Incomplete data distinctly. Never omit a required manifest row.
Approval is visually unavailable whenever a blocker exists:

- Any shortage, missing required item, or uncounted component.
- Invalid input, unsaved changes, an in-flight save/decision, or stale revision.
- Unauthorized actor, an own-created order, or an order/attempt outside the
  permitted verification state.

Explain the actual blocker in visible text. A saved complete set of Match/Excess
counts can be eligible; excess alone does not block approval. Fabric cap excess
or signed negative fabric variance is informational/warning-only and adds no
gate. UI eligibility is only a usability indication: backend validation remains
authoritative and rechecks actor, state, revision, manifest, and saved counts.

Use explicit Save Counts, not autosave. Reload restores saved counts. A backend
422 highlights affected inputs/components; a 409 requires an authoritative
reread and retains local edits for deliberate review without silently replacing
another verifier's work. Do not optimistically show Verified before success.

Reject requires a trimmed reason of 1-1000 characters and can be used for physical
defects even when counts match. Preserve the reason on a failed rejection.
Approval confirmation identifies the order and immutable sign-off consequence.
After a finalized decision, show authoritative outcome/evidence and make count
editing unavailable. Do not add bypass, override, or decorative decision controls.

## Role-specific workspaces

### Cutting Supervisor

Focus on active cutting orders, rejected work requiring attention, creation and
submission, clear state, and recipe-derived requirements. Use the actual order
list as the main work area, with relevant filters and a clear Create Order action.
Do not invent production charts or statistics cards for the landing page.

Create/prepare forms contain recipe, target quantity, fabric roll ID, and actual
fabric yards, with derived component requirements beside or below the inputs.
Clearly distinguish unsaved preview, saved preparation, and submission. Explain
that first submission freezes recipe/target/BOM. Rejected detail foregrounds the
reason and Begin Re-cut action, retains prior attempt evidence, and makes frozen
requirements read-only. Do not offer a generic production-status selector.

### System administration

Admin pages should feel like system administration. Use tables and compact forms;
the Users list is the primary landing content. Its primary columns are Name,
Email, Role, Account status, Created, and Relevant action. Administrative audit
has its own read-only table. Avoid unnecessary admin analytics.

Create User follows the existing email/full name/production role/temporary
password contract. Clear the password after submission completion; never echo it
in a success panel or store it in browser persistence. Account activity and role
changes have explicit labels and confirmation where consequential. No production
navigation, manufacturing commands, impersonation, or force-state controls.

### Sewing Supervisor

Focus on ready, verified work. Show Order, Recipe, Quantity, Verification
attribution, Verification time, Relevant count information, Fabric variance,
and Sewing start state. Use the immutable approved evidence, including signed
component/fabric variances. Supporting detail can move to a batch detail pane;
identity, verification attribution, time, and start action remain easy to find.

Queue, detail, search, totals, pagination, and empty-state copy must reveal only
VERIFIED work. Do not expose pending/rejected records, hidden-record counts, or
filters that disclose them. An empty queue says no verified batches are available.
Start Sewing Assembly records start metadata; the batch remains VERIFIED. Show
Started with attribution/time and make repeat start unavailable. Do not invent a
new sewing production status or execution dashboard.

## Accessibility requirements

Target WCAG 2.2 AA where practical. The following are required review criteria;
documentation and token checks do not establish application conformance:

- Use semantic headings, labels, links, buttons, table headers, and landmarks;
  offer a skip link past repeated navigation.
- Operate all actions by keyboard with a logical order and visible focus. Do not
  hide focused controls behind sticky bars, drawers, or action footers. See
  [W3C Focus Not Obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).
- Apply the mandatory contrast contract across all field, menu, and action states.
- Present status with text plus color/icon, never color-only traffic lights.
- Name dialogs, manage their focus and return, and support dismissal/cancel safely.
- Associate errors with fields and announce useful submission errors. Announce
  save/loading/result changes with suitable live regions; do not announce every
  keystroke or repeatedly interrupt count entry.
- Make pointer targets at least 24 by 24 CSS pixels; this project uses 44px touch
  targets for factory entry/navigation. Do not rely on tight target spacing to
  justify tiny controls. See [W3C Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Preserve browser zoom and text resizing. Check 200% text enlargement and reflow
  at approximately 320 CSS pixels/400% desktop zoom; essential two-dimensional
  tables may scroll within a labeled region while surrounding content reflows.

## Responsive review

Review approximately 1280px desktop, 768px tablet, and 375px mobile at minimum.
These are required review sizes, not a license to ignore intervening widths.

| Review width   | Expected behavior                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1280px desktop | Persistent shell; compact sidebar/top bar; useful table density. Order identity, expected/actual/result, and decision actions scan clearly. No page overflow or unnecessary table horizontal scroll.                         |
| 768px tablet   | Collapse sidebar into accessible navigation when needed; stack split panes and reduce form columns. Preserve identity, labels, status, and actions; use touch targets for coarse pointers.                                   |
| 375px mobile   | Single-column forms, wrapped page actions, accessible collapsed navigation, and full-width count entry where needed. Use at least 16px input text and 44px touch targets. Dialogs fit available width and scroll vertically. |

At narrow widths, use labeled per-record rows when that preserves the same
information, or a clearly labeled keyboard-accessible horizontally scrollable
table region when two-dimensional comparison is necessary. Repeated record
groups are a responsive information layout, not nested decorative cards.
Confine horizontal scrolling to the table rather than the whole page. Never
merely shrink all text, remove essential columns, or make decision actions
unreachable. Sticky controls must leave content and keyboard focus visible.

## shadcn/ui adaptation

shadcn/ui is a component foundation, not a design system by itself. Use its
accessible primitives and apply ApparelFlow tokens, density, and visual language.
Do not accept default styling everywhere without review. Do not install or
generate components during UX00.

Future implementation should map the component foundation to this contract:

| Foundation token/concern                                     | ApparelFlow mapping                                                                                 |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `background` / `foreground`                                  | App background / primary text.                                                                      |
| `card`, `popover` and their foregrounds                      | White surface or elevated surface / primary text; using a token does not justify a card wrapper.    |
| `primary` / `primary-foreground`                             | Blue primary / white on-primary.                                                                    |
| `secondary` and `accent` / foregrounds                       | Neutral hover background / primary text; these do not introduce extra brand colors.                 |
| `muted` / `muted-foreground`                                 | Neutral background / readable subtle text.                                                          |
| `border` / `input`                                           | Structural border / stronger control border respectively.                                           |
| `ring`                                                       | Focus blue with visible outline/separation.                                                         |
| `destructive` / foreground                                   | Dark red / white for filled destructive actions.                                                    |
| Radius, heights, padding, shadows                            | Shared geometry and spacing above; remove pill defaults, oversized padding, and decorative shadows. |
| Disabled, invalid, read-only, autofill, portaled menu states | Explicit state tokens and measured text/boundary contrast; replace low-opacity defaults.            |
| Component status                                             | Dedicated Match/Excess/Shortage tokens plus labels; no invented chart palette.                      |

Keep adaptations in shared tokens and reusable components when implementation
is later authorized. Inspect existing components before adding another variant.
Recheck keyboard/dialog behavior after customization; accessible primitives
still require correct labels, content, focus handling, and state wiring.

## Required UI implementation process

Before implementing any new page, and when reviewing a substantial UI change:

1. Read this document.
2. Read the relevant business requirement and role/state contracts.
3. Identify the user's operational task.
4. List only the information required for that task; identify its real source.
5. Define page hierarchy and the main action, including blocking/error states.
6. Reuse existing components and tokens; inspect current implementation first.
7. Implement within the authorized milestone and backend contract.
8. Check contrast using actual computed colors, including all input/menu states.
9. Check keyboard interaction, labels, dialogs, errors, and focus visibility.
10. Check responsive behavior at the required widths, with zoom/reflow review.
11. Remove decorative or unnecessary UI and invented data/widgets.
12. Compare against every anti-AI-slop rule above.

Record the relevant contrast, keyboard, responsive, and workflow checks in the
implementation review. A screenshot alone cannot prove keyboard operation,
contrast, persistence, or server enforcement. Use the existing
[11 Test plan](11_TEST_PLAN.md), particularly UI-02/UI-03 and ASMT-02, for the
operational acceptance cases. Do not claim UI checks passed during UX00.

Before considering a page complete, ask:

> Would this look credible on a real garment factory workstation used all day,
> or does it look like a generated Dribbble/SaaS concept?

If the latter, simplify it. UX00 ends with documentation; future UI implementation
requires its separately authorized task and must obey this contract.
