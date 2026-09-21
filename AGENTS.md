AGENTS.md
Local-First Web Application Standard (offline · installable · Persian-ready)
Edition 4 — manual local distribution model (rewritten with maintainer approval as an exception to 0.5; hardened after incidents I-1 through I-7).

0. Purpose of this file
This repository contains a local-first, offline-capable web application
("local web app"): a static HTML/CSS/JavaScript app that runs by
double-clicking index.html from disk AND/OR being served by a
zero-dependency local server, and that can be installed as a Web
Application (PWA) with its own icon and standalone window.
Any AI agent or automation assistant working in this repository must read
this entire file before making architecture, UI, typography, data, storage,
PWA/installability, caching, server, versioning, or release changes, and
must follow it.
This file is a reusable, portable standard. It is NOT the memory of any
specific repository. When copied into a new repository, treat sections 1-17
as the target state and section 18 as an empty living record to be filled
after the first verified run.
Goals:
- Works fully offline with ZERO external network requests.
- Dual-mode: file:// (double-click) and http://localhost:<PORT> (local
  server), with graceful, documented feature differences.
- Installable as a Web Application (own icon, standalone window,
  taskbar/Start/home-screen entry) from localhost with no flags.
- Enforces Persian typography (Vazirmatn) and full RTL whenever Persian
  text exists, with a VERIFIABLE font pipeline (visual appearance is never
  accepted as proof).
- Advanced, accessible, printable UI: dark/light themes, tabs, searchable
  comboboxes, result cards, badges, notices, toasts, empty states,
  history/favorites, import/export, keyboard support, schematic SVG
  diagrams where the domain needs them.
- Local data ownership: JSON datasets + generated embedded fallback +
  localStorage (settings/history/favorites/overrides) with import/export.
  Nothing ever leaves the machine.
- Zero build step, zero runtime dependencies, zero secrets, zero binary
  assets in Git.
If any instruction in this file conflicts with offline-safety, privacy,
installability, or data integrity, stop and explain the conflict instead
of guessing.

0.5. CRITICAL MANDATE: Post-Fix Prompt Evolution & Maintenance
Immediate Review on Issue Resolution: whenever the user reports an issue,
bug, install failure, caching bug, font/render bug, server crash, or data
loss, after resolving the issue you MUST inspect this AGENTS.md file.
Prompt Gap Analysis: check whether the root cause and its solution are
already covered here.
Proactive Prompt Update:
- If the issue or rule is missing, you MUST immediately append a clear,
  actionable standard or rule to this file.
- If an existing rule is incomplete or inaccurate, you MUST update and
  refine it.
- You may only append or refine rules. You MUST NOT rewrite, summarize, or
  reformat the whole file, and you MUST NOT modify section 18 recorded
  values except as explicitly allowed by section 18 itself.
Goal: maintain this file as a comprehensive, self-healing master reference.

0.6. Runtime Model & Repository Visibility Policy
Dual-Mode Mandate: every feature must behave correctly in BOTH modes:
- Mode A (file://, double-click): browsers block fetch() of local JSON,
  block Service Workers, block ES modules, and restrict some APIs
  (e.g. clipboard). The app MUST feature-detect and degrade gracefully
  with ZERO console errors (embedded data fallback, guarded registrations,
  try/catch around every storage/network API).
- Mode B (http://localhost:<PORT>): full feature set including live JSON
  loading, Service Worker, and PWA install.
Visibility: this standard guarantees the repository never contains secrets
or binary assets, therefore a PUBLIC repository is acceptable from day one.
If visibility cannot be determined, assume Public and apply the stricter
rules.
Fresh-Start Rule: a brand-new project has no legacy keys, caches, schemas,
or installed users. Migration rules (1.8, 5.4) apply only after section 18
has been filled for the first time.

1. Non-negotiable Rules for Local Web Apps
1.1 Offline-first: with the network disabled AND the server stopped, every
core user flow must complete from local files and caches only.
1.2 Zero external requests: no CDN, no Google Fonts, no analytics, no
remote API, no remote image/font/script/style URL anywhere (HTML, CSS, JS,
manifest, SW). Grep-verify on every change.
1.3 Zero build step and zero runtime dependencies: the app must run by
opening index.html with no bundler, no transpiler, and no node_modules.
package.json "dependencies" MUST stay empty forever. Node.js is development
tooling only (server, generators, tests), and EVERY server/tool script must
use Node built-in modules only (Appendix A, I-1).
1.4 Dual-mode correctness: classic scripts (IIFE attaching to ONE global
namespace), explicit script load order, NO ES modules (file:// CORS).
Embedded data fallback for Mode A. Protocol-guarded Service Worker
registration. try/catch around every browser API that may be missing.
1.5 Installability: a valid manifest (9), Service Worker (10), and locally
generated icons (11) must make the browser offer installation from
localhost with no flags and no console errors.
1.6 Data locality & privacy: all user data lives in namespaced, versioned
localStorage keys; import/export is provided; nothing leaves the machine;
zero telemetry, zero cookies, zero third-party storage.
1.7 No secrets ever: no API keys, tokens, passwords, or private material
in code, data files, or repository history.
1.8 Storage update safety: renaming or restructuring localStorage keys,
cache names, or data schemas requires a version bump plus either a
migration or a clean reset WITH a visible Persian notice. Never silently
destroy user data (history, favorites, settings, imported overrides).
1.9 Persian content rule: if ANY user-visible string is Persian, ALL of
section 4 applies. Silently shipping default fonts or LTR layout while
Persian text exists is a policy violation equal to a security bypass.

2. Agent Mission
The agent must implement or repair, as needed: app shell and tabs;
searchable comboboxes; result rendering; settings forms; history and
favorites; JSON/CSV import-export; copy-to-clipboard; print styles; theme
toggle; status/source badge; schematic diagrams (if the domain needs them);
manifest; Service Worker; icon and font generator tools; zero-dependency
local server; dev tools and tests; README; metadata and versioning.
The agent should prefer small, reviewable changes and must not introduce
unrelated refactors.

3. Repository Discovery Checklist
Before changing anything, inspect and identify: index.html structure and
element ids; css token names; js global namespace and script load order;
data/ datasets, SCHEMA files, settings defaults, and embedded fallback;
icons/ (SVG committed? PNGs generated locally?); fonts/ pipeline state
(b64 present? woff2 generated? README present?); tools/ inventory;
server.js dependencies (must be none) and its MIME/routing behavior;
package.json dependencies (must be empty) and scripts; metadata/version
values; localStorage key prefixes; SW cache prefix and version; manifest
fields; whether Persian text exists; README run modes; .gitignore binary
exclusions; repository visibility.

4. UI & Typography Standards
4.1 Language & direction: if the UI is Persian, set lang="fa" dir="rtl" on
<html>; use logical CSS properties (inline-start/inline-end, margin-inline)
instead of left/right; verify combobox dropdowns, tables, badges, and
diagrams render correctly in RTL.
4.2 Vazirmatn font pipeline (text-only assets; appearance is NOT proof):
- Allowed pipelines:
  (a) PROVEN DEFAULT: commit base64 TEXT files fonts/src/*.b64 (weights
      400/500/600/700) plus a zero-dependency tools/make-fonts.js that
      decodes them into fonts/*.woff2 at local run time; decoded outputs
      are gitignored.
  (b) Maintainer-approved alternative: fonts/README.txt with exact one-time
      manual download/placement instructions; files stay local, never
      committed.
  (c) In all cases: @font-face with font-display: swap and a system
      fallback stack (Vazirmatn, Tahoma, Arial, sans-serif) so the app
      works with ZERO console errors when fonts are absent.
- RED RULE: never silently skip font integration while Persian text exists,
  and NEVER conclude "the font works" from a screenshot: a system-installed
  Vazirmatn masks missing webfonts and hides the defect on one machine only
  (Appendix A, I-3).
- MANDATORY verification: DevTools -> Elements -> Computed -> Rendered
  Fonts must report family "Vazirmatn" whose origin is a PROJECT resource
  (localhost network response or project file), NOT a local/system font and
  NOT the fallback family. Record this verification in the final summary
  (section 16) and in section 18.
- When fonts are not yet placed/generated, the app must still render with
  the fallback stack and zero console errors, and README must state the
  one-time placement/generation step.
4.3 Numbers & bidi: technical values (sizes, codes, dimensions, formulas,
versions) render in Latin digits inside isolated LTR spans
(direction: ltr; unicode-bidi: isolate) so RTL sentences never reorder
them; input parsing must normalize Persian and Arabic digits to Latin and
support fractions ("1-1/4", "3/4", "0.75").
4.4 Themes: dark theme default plus light theme; all colors as CSS custom
properties on html[data-theme]; theme persisted in localStorage; header
toggle with aria-pressed and visible label; print always forces the light
palette.
4.5 Accessibility & keyboard: skip link; landmark regions; tabs implemented
with role=tablist/tab/tabpanel and arrow-key navigation; comboboxes with
role=combobox + listbox options, aria-expanded, Enter/Escape/Arrow keys;
visible :focus-visible outlines; minimum touch target 44x44 px; aria-live
regions for async results; every input labelled; Ctrl+P prints results.
4.6 Component conventions: card containers with head/sub; key-value grids
with optional hero emphasis; badge variants (standard, face/type, ok,
warn, danger, datasource); notice banners (info/warn/ok/danger); toast
feedback for copy/save/import actions; empty states with icon and
guidance; chips for favorites with inline delete; wrapped scrollable
tables; segmented controls for unit/mode switches; searchable combobox
with clear button and "no match" message.
4.7 Print: @media print hides header/tabs/buttons/combobox lists, forces
white background and black text, prevents page breaks inside result cards
and diagrams, and appends the domain disclaimer line after results.
4.8 Diagrams (optional, domain-driven): inline SVG generated in JS
(text-only, no images), clearly labelled "schematic - not to scale", with
clamped leader lines and labels so text never overflows the viewBox, a
legend row above multi-part figures, and print-safe color overrides.
4.9 Error safety: a global window error handler writes a short Persian
message into a header status badge; every boot step is wrapped in try/catch
so a single failure can never blank the whole UI; boot must work both when
DOMContentLoaded is still pending and when it has already fired (warm
cache on file://).

5. Versioning & Metadata Policy
5.1 Semantic Versioning MAJOR.MINOR.PATCH stored in package.json and
metadata.json; the footer renders it via a dedicated element id.
5.2 Bump rules: PATCH for fixes, MINOR for new features, MAJOR for breaking
data/schema/storage changes.
5.3 Version maintenance: the agent bumps and records the semver version in
package.json and metadata.json upon applying changes; this version string
drives the Service Worker cache name prefix (<app>-<version>-) so client
caches rotate cleanly, and populates the UI footer version display.
5.4 README keeps a dated changelog section (<YYYY-MM-DD>: short note).
5.5 localStorage key names, Service Worker cache names, and data schema
versions embed the prefix/version recorded in section 18; any structural
change follows rule 1.8.

6. Architecture & File Layout
index.html               single page, tabbed panels, explicit script order
css/style.css            tokens, themes, components, responsive, print,
                         @font-face
js/<concern>.js          classic scripts on ONE global namespace, load
                         order: utils/search -> domain logic -> storage ->
                         ui -> app bootstrap
data/*.json              domain datasets
data/SCHEMA-*.json       field-by-field documentation for every dataset
data/settings.json       default calculation/display settings
data/data-embedded.js    GENERATED offline fallback globals (never
                         hand-edit; regenerated by tools/generate-data.js)
icons/favicon.svg        committed TEXT icon
icons/*.png              GENERATED locally (gitignored)
fonts/src/*.b64          committed base64 TEXT fonts (pipeline 4.2a)
fonts/*.woff2            GENERATED locally (gitignored)
tools/*.js               zero-dependency dev tools (generate-data,
                         make-icons, make-fonts, smoke-test, check-dom,
                         check-structure)
server.js                zero-dependency static server (Node built-ins)
Rules: strict separation of concerns; domain-logic modules must be pure
and DOM-free (loadable in Node vm for tests); UI rendering isolated in the
ui module; bootstrap isolated in the app module; no globals outside the
namespace; ALL runtime paths resolve relative to the document or the server
file location, never process.cwd(), so the project works from any drive or
folder path including spaces and non-ASCII names.

7. Data, Storage & Persistence
7.1 Load priority: user-imported override (localStorage) > fetched
data/*.json (Mode B) > embedded fallback globals (Mode A). A status badge
always shows the active source plus record counts.
7.2 Every fetch is optional and caught (null on failure) so Mode A never
errors; every localStorage access is wrapped in try/catch (private mode,
quota).
7.3 Settings: file defaults merged with a saved patch (merge, never
replace); reset-to-defaults button provided.
7.4 History capped (default 30, configurable) and favorites list, both with
export (CSV with UTF-8 BOM for Excel; JSON) and clear buttons; clicking a
history/favorites entry re-runs the original query.
7.5 Import: file inputs parsed via FileReader and structurally validated
against the SCHEMA shape BEFORE applying, with Persian success/error
status messages; imported overrides are removable at any time ("back to
shipped data").
7.6 The embedded fallback is regenerated by tools/generate-data.js whenever
JSON datasets change; tools/smoke-test.js loads the embedded copy and
asserts known-good values so the fallback can never drift silently.

8. Binary Asset Protocol (text-only repository)
8.1 NEVER commit binary files (woff2, ttf, png, ico, zip, ...) from a web
IDE: the web commit pipeline silently re-encodes binary bytes as text and
the asset breaks at first use (Appendix A, I-2). The repository tree
contains ONLY text: HTML, CSS, JS, JSON, MD, SVG, and base64 TEXT (.b64).
8.2 Icons: commit icons/favicon.svg (text). PNG icons (192, 512, maskable
512) are materialized LOCALLY by tools/make-icons.js - a zero-dependency
Node script (built-in zlib + manual CRC) that draws the logo
programmatically; outputs are gitignored.
8.3 Fonts: per 4.2 (base64 TEXT + tools/make-fonts.js, or README manual
placement); decoded outputs are gitignored.
8.4 .gitignore MUST include: fonts/*.woff2, icons/*.png, node_modules/,
*.log, tmp/, and any other generated output.
8.5 README documents the one-time local generation commands; the app never
crashes when generated assets are missing (favicon SVG always present;
manifest icon entries resolve after generation).
8.6 A release or install failure occurring right after adding a binary
asset is presumed to be this corruption until proven otherwise.

9. Web App Manifest Requirements
9.1 manifest.webmanifest at repository root, linked from index.html with a
RELATIVE href.
9.2 Required fields: name (Persian full name plus English), short_name
(short Persian), description, lang "fa", dir "rtl" (when Persian),
start_url "./" or "./index.html", scope "./", display "standalone"
(use "fullscreen" only if the maintainer explicitly asks),
background_color and theme_color matching the dark theme tokens.
9.3 Icons array: 192 PNG purpose "any", 512 PNG purpose "any", 512 PNG
purpose "maskable", plus the SVG favicon with sizes "any". All paths
relative.
9.4 No absolute URLs, no external URLs, no orientation lock unless asked.
9.5 The manifest must remain structurally valid BEFORE PNG generation (the
SVG entry is always present); missing PNGs must never crash boot - the
browser may warn only, and the generator step (8.2) resolves it.

10. Service Worker Requirements
10.1 sw.js at root; index.html registers it ONLY when location.protocol is
"http:" or "https:" (guard), using a relative path; on file:// registration
is skipped SILENTLY with zero console errors (Appendix A, I-4).
10.2 Cache names prefixed "<app>-<version>-" so releases rotate cleanly.
10.3 install: precache the app shell (index.html, css, all js, embedded
data, favicon, manifest, and generated icons WHEN PRESENT) using per-item
catch so one missing file can never fail installation; then skipWaiting.
10.4 fetch: intercept same-origin GET only; stale-while-revalidate for
static assets; navigation requests try network first and fall back to the
cached shell when the server is unreachable (this is what lets the
installed app launch with the server stopped); NEVER intercept cross-origin
or non-GET; NEVER serve index.html for asset requests that carry a file
extension - missing assets must surface as real failures, not masked
(Appendix A, I-5).
10.5 activate: clients.claim and delete every cache whose name starts with
the app prefix but not the current version.
10.6 The SW never caches secrets (none exist by design) and remains a
silent no-op in Mode A.

11. Icons & Installability Verification
11.1 The zero-dependency generator tools/make-icons.js exists per 8.2 and
its one-time command is documented in README.
11.2 Verification checklist (Mode B, Chrome/Edge): install icon appears in
the address bar; menu install succeeds; the installed app opens in a
standalone window with the custom icon in title bar, taskbar, and Start
menu; after stopping the server the installed app still launches from
cache; uninstall via browser settings works; console is free of manifest
icon errors.
11.3 Symptom handling: console warning "Error while trying to use the
following icon from the Manifest" means missing/invalid PNGs - run the
generator; if generated PNGs exist but the error persists, suspect the
server returning HTML for the asset (I-5) and check Content-Type in the
Network tab.
11.4 Android/home-screen add and Firefox must degrade gracefully (app still
usable as a tab); no crash and no missing-asset console errors.

12. Local Server & Run Protocol (Manual Distribution)
12.1 server.js uses ONLY Node built-ins (http, fs, path, url). No express
or any other dependency - a fresh clone or extracted ZIP without
node_modules starts immediately (Appendix A, I-1). PORT constant default 3000,
overridable via process.env.PORT; bind localhost by default; startup log line
printed.
12.2 Static serving from the project root with an explicit MIME map (html,
css, js, mjs, json, webmanifest, svg, png, ico, woff2, woff, ttf, map, txt,
md) and path-traversal protection (resolved path must stay inside root).
12.3 Routing rule: unknown GET WITHOUT a file extension -> index.html
(navigation/SPA fallback); unknown path WITH a file extension -> a true 404
with correct status and empty body. NEVER return index.html for a missing
asset (Appendix A, I-5).
12.4 Caching headers: no-store for index.html, manifest.webmanifest, and
sw.js so updates propagate immediately; normal caching for other static
assets is optional.
12.5 Local Run Modes:
- Mode A (file://): double-click index.html directly; runs completely
  offline via embedded fallback data.
- Mode B (http://localhost:3000): run `npm start` (or `node server.js`);
  serves live JSON and registers Service Worker.
- Mode C (Installed PWA): navigate to Mode B, install from address bar;
  app launches in standalone window and runs offline even when server is
  stopped.
12.6 One-time asset generation: `npm run assets` runs `node tools/make-icons.js`
and `node tools/make-fonts.js` in sequence idempotently. If `fonts/src/*.b64`
is not present, `make-fonts.js` cleanly prints an informational note and
exits with code 0 without breaking the asset run.
12.7 package.json: dependencies empty (`{}`); scripts:
- start & dev: `node server.js`
- test: `node tools/smoke-test.js`
- lint: `node tools/check-dom.js`
- icons: `node tools/make-icons.js`
- fonts: `node tools/make-fonts.js`
- assets: `node tools/make-icons.js && node tools/make-fonts.js`
- data: `node tools/generate-data.js`

13. Security & Privacy Requirements
13.1 No external URLs anywhere (grep-verify); optional CSP meta limited to
'self' plus the inline styles the vanilla UI needs; connect-src 'self'.
13.2 ALL dynamic strings inserted into the DOM pass through one shared
escapeHtml utility; raw innerHTML of user-provided or imported content is
forbidden.
13.3 No eval, no new Function, no document.write, no remote code.
13.4 localStorage and FileReader usage wrapped in try/catch with Persian
error messages; imported JSON validated against schema shape before use.
13.5 The server enforces the traversal guard (12.2) and exposes NO write
endpoints whatsoever.
13.6 Zero telemetry, zero cookies, zero third-party storage.

14. Testing, Verification & Definition of Done
14.1 tools/smoke-test.js: loads embedded data plus the pure logic modules
in a Node vm context and asserts maintainer-supplied known-good values;
exits non-zero on any failure.
14.2 tools/check-dom.js: every element id referenced from JS exists in
index.html; tools/check-structure.js: panel/section nesting sanity.
14.3 Manual checklist before declaring done:
- Mode A opens with zero console errors and the badge shows the embedded
  source.
- Mode B badge shows the file source; searches, inputs, and keyboard
  navigation work.
- DevTools -> Computed -> Rendered Fonts reports Vazirmatn from a PROJECT
  resource (not a system font, not the fallback) whenever Persian text
  exists (I-3).
- Network tab: no request to any external origin; missing local assets
  return 404, never 200-with-HTML (I-5).
- Manifest + SW: install prompt appears, install succeeds, standalone
  window shows the custom icon.
- Stop the server: the installed app still launches from cache.
- Theme persists across reload; history/favorites persist and export;
  print preview is clean.
- "npm start" (or node server.js) works in a folder that has NO
  node_modules (I-1).
14.4 Definition of Done:
[ ] App fully functional offline in Mode A and Mode B.
[ ] Zero external requests (grep-verified).
[ ] Manifest + SW + generated icons satisfy install criteria; install and
    offline-launch tests passed.
[ ] Vazirmatn applied and Rendered-Fonts-verified (or not applicable).
[ ] Dark/light themes, print styles, a11y and keyboard rules met.
[ ] Data import/export and storage safety rules met; badge shows source.
[ ] server.js zero-dependency; README run modes accurate (manual distribution).
[ ] Tests pass (smoke + dom check); version bumped; changelog updated.
[ ] Repository contains no binaries and no secrets.
[ ] No GitHub Actions workflow files exist in the repository.

15. Behavior When Uncertain
Stop and ask a human maintainer when: dataset values or engineering
formulas are ambiguous; a schema change would orphan user data; a
dependency or build step seems required; port conflicts or OS restrictions
appear; font or icon binaries cannot be produced by either allowed
pipeline; install criteria fail for unknown reasons; repository visibility
is ambiguous; any request conflicts with sections 1, 8, 10, or 13.
Do not guess in data-correctness, privacy, or installability situations.

16. Final Agent Summary Requirement
After completing work, output: files changed/created; generated-vs-committed
assets status (icons, fonts, embedded data); manifest/SW status and cache
version; font pipeline status INCLUDING the Rendered-Fonts verification
result; version bump and changelog entry; tests run and results;
install-test and offline-launch status; any warnings about data migrations
or deprecated storage keys.

17. Single-Writer Rule, Repository Hygiene & Distribution Channel
This project is developed exclusively in Google AI Studio. AI Studio is the
ONLY place that creates commits and pushes.
- Official Distribution Channel: manual download/export from AI Studio or
  GitHub repository ZIP archive / clone and local zero-dependency run.
- CI/CD & Registry Policy: creating any GitHub Actions workflow, CI/CD
  pipeline, or publishing to external registries (such as npm) is STRICTLY
  FORBIDDEN unless explicitly requested by the maintainer (referencing
  Incident I-7).
- Local clones are READ-ONLY: only running the app/server/tools and inspection
  are allowed. git commit, git push, and history rewrites from any local machine
  are FORBIDDEN (they permanently diverge the workspace).
- Do NOT re-import this repository into a new AI Studio project; always
  continue in the original connected project.

18. Verified State Record (living, per-repository)
This section is a living record, NOT hardcoded project memory. BEFORE first
verification it is empty and imposes no repository-specific constraints.
AFTER the first verified run (Mode A + Mode B + install test + offline
launch test), the agent MUST fill the template with real values and keep it
updated; recorded values are FROZEN unless the maintainer approves a
change.
Template:
- Repository: <owner>/<repo>
- Visibility: <Public|Private>
- App name / global namespace: <name> / <window.X>
- Version: <MAJOR.MINOR.PATCH>
- Distribution model: manual local (ZIP / clone / AI Studio export)
- Asset materialization command: npm run assets (idempotent make-icons + make-fonts)
- localStorage prefix & schema versions: <prefix.v1 ...>
- Service Worker cache prefix & version: <app-<version>->
- Local server: zero-dependency confirmed <yes/no>; port <3000>
- Font pipeline: <none | b64+decode | manual README>; generated <date>;
  Rendered-Fonts verified <date>
- Icon pipeline: generator present <yes/no>; PNGs generated locally <date>;
  install verified <date>
- Last verified offline launch (server stopped): <date>
- Data source priority verified (override > fetch > embedded): <date>
- Last verified local run date: <date>
- Last verified PWA install test date: <date>
- Storage/schema migration history: (empty unless migrations occurred)
- GitHub Actions workflows: none (verified zero workflow files)
- Secrets: none by design (section 1.7)

Appendix A - Incident Register (origin project: Flange & Stud Bolt Finder,
2026-09). Each incident is baked into the rules above; agents must not
re-litigate them, only extend via 0.5.
I-1 Dependency crash on fresh copy: server.js required express; a copied
    clone without node_modules failed at startup with MODULE_NOT_FOUND.
    Fix: zero-dependency server using Node built-ins. Rules 1.3, 12.1,
    12.5, 14.3.
I-2 Web-IDE binary corruption: binaries committed through web IDEs are
    silently re-encoded as text and break at first use. Fix: text-only
    repository plus local zero-dependency generators. Rules 8.1-8.6, 4.2.
I-3 System-font masking: the app rendered Vazirmatn on the maintainer's
    machine only because the OS had Vazirmatn installed; the repository
    contained no font files and every other machine silently fell back to
    Tahoma. Fix: Rendered-Fonts verification mandate and explicit font
    pipeline. Rules 4.2, 14.3, 16.
I-4 Service Worker noise on file://: unguarded registration threw errors
    in Mode A. Fix: protocol guard with silent skip. Rule 10.1.
I-5 HTML-for-missing-asset: the SPA fallback returned index.html (HTTP 200,
    text/html) for missing font/icon files, producing misleading
    "invalid image/font" parse errors and hiding the real 404. Fix:
    extension-aware routing with true 404; SW must not mask missing assets.
    Rules 12.3, 10.4, 14.3.
I-6 Install blocked by missing icons: manifest referenced PNGs that did not
    exist; console manifest-icon error and broken install identity until
    PNGs were generated locally by the zero-dependency tool. Fix: generator
    plus install verification checklist. Rules 8.2, 9.5, 11.1-11.3.
I-7 Release CI friction & registry overhead: attempting to maintain an
    automated npm publish / GitHub Actions pipeline (token management, OIDC
    Trusted Publishing bootstrap, initial publish 404 collisions, Secrets
    handling) added significant maintenance overhead without value for a
    zero-dependency, single-maintainer offline engineering tool. On
    2026-09-21, the maintainer decided to return to the manual local
    distribution model. Rule: the agent must never propose or create release
    CI/CD workflows or registry publishing pipelines unless explicitly
    requested by the maintainer. Rules 12.5, 14.4, 17.
