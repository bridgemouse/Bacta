## What does this do?

<!-- One paragraph describing the change and why -->

## Android only: docs and web comparison

<!-- Docs consulted (pages read) and anything that deliberately differs from the web app. Delete this section for non-Android changes. -->

## How to test

<!-- Steps to verify the change works -->

## Checklist

- [ ] `npm test` passes
- [ ] `npx tsc --noEmit` passes (client)
- [ ] `npx tsc -p tsconfig.server.json --noEmit` passes (server)
- [ ] Inline styles only (no CSS files, no Tailwind)
- [ ] Dark UI only
- [ ] No new comments unless the WHY is non-obvious
