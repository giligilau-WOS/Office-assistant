# Architecture & UI/UX Agent Instructions

All AI coding and architecture agents working in this repository **MUST** read and strictly follow:

1. **[UI_DESIGN_RULES.md](./UI_DESIGN_RULES.md)** — Authoritative UI/UX, Zero-Scroll Viewport Budget (`1280×620`+), Master-Detail Sub-Page Architecture, ROC Date & Readability Standards, Clean Slot Registry Architecture (no new monkey-patching or ghost DOM), Public Repository Privacy Rules, and Pre-Defined Contracts for Future Modules (`F1`–`F8`).
2. **[UX_AUDIT_REPORT.md](./UX_AUDIT_REPORT.md)** — Empirical viewport overflow diagnostics, frontend wrapper-chain debt analysis, readability findings, and phased refactoring roadmap.

## Mandatory Pre-Merge Checks
- Run `node --check *.js` and verify all `<script src="./...">` references in `index.html`.
- Run `verifyDesignRulesCompliance()` (defined in `UI_DESIGN_RULES.md` §6) in headless Chromium at `1366×650` and `1440×820` to ensure zero outer scroll, zero ghost legacy DOM, minimum `12px` font size, and zero narrow-column single-line truncation.
- Never hardcode school-specific personal data, vendor tax IDs, phone numbers, bank account numbers, policy numbers, or Google Sheet IDs into source files in this public repository.
