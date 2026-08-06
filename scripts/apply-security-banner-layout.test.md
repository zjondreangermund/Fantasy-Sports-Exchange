This marker file documents the layout regression covered by `verify-security-banner-layout.mjs`:

- the fixed production/read-only banner publishes its measured height as `--security-banner-offset`
- the app content begins below that offset
- desktop and mobile sidebars use the same offset and reduced viewport height

The executable verification runs before TypeScript and client builds.
