# v1.0.1

## Changes

- Preserve Markdown hard breaks written as two or more trailing spaces before a newline, including inside bold text and quotes.
- Support Ctrl/Cmd+B for bold and Ctrl/Cmd+* (Shift+8) for italic in the source editor, preserving the selection or placing the caret between empty markers.
- Keep formatting changes in the existing autosave and local draft flow.
- Exclude ignored independent projects and generated outputs from the core TypeScript build.

## Validation

- Production builds passed for both the NAS core and the independent Sites adapter.
- All five core regression tests passed, including server-rendered hard breaks and ordinary soft breaks.
- Chrome checks passed for Control/Meta shortcuts, numpad asterisk, empty and partial selections, whitespace, IME composition, preview rendering, autosave and reload.
- The NAS candidate passed the same editor checks before cutover; production content and media matched the baseline, and SQLite integrity returned `ok`.

## Deployment

- NAS image: `g0dlog:1.0.1`; the previous `g0dlog:20260911-public-reading` container remains stopped as `g0dlog-rollback-v1.0.1-20260912` for rollback.
- The existing NAS storage mounts were preserved and a verified backup was created before cutover; private host paths and operational details remain in ignored local release records.
- The independent Sites adapter uses application version `1.0.1` and preserves its existing D1/R2 bindings, accounts, content and public audience.
- Sites publication succeeded at https://g0dlog-mvp.charles4carlos55.chatgpt.site (platform version 2, application version 1.0.1).
