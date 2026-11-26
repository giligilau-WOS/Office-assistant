# Claude / Architecture AI Instructions

Before modifying any UI, CSS, layout, or JavaScript module in this repository, you **MUST** read and strictly comply with:

- **[UI_DESIGN_RULES.md](./UI_DESIGN_RULES.md)** — Mandatory Zero-Scroll Viewport Budget (`1280×620` to `1920×1080`), 2D Bento Dashboard & Master-Detail Sub-Page Layout Rules, Readability & ROC Date Standards (`>= 12px`, `formatSmartTitle`, `tabular-nums`), Clean Slot Registry Architecture (banning new `renderCurrentView` monkey-patch layers and hidden legacy DOM), Public Repo Privacy Rules, and Future Module Specifications (`F1`–`F8`).
- **[UX_AUDIT_REPORT.md](./UX_AUDIT_REPORT.md)** — Full audit baseline and refactoring roadmap.

Always run `node --check *.js`, `runClaudeVerificationSuite()`, and `verifyDesignRulesCompliance()` (`UI_DESIGN_RULES.md` §6) at `1366×650` and `1440×820` before committing.
