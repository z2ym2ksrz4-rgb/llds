/** Release gate. Anything internal (test menu, version banner, seed data) must be wrapped in `if (!isRelease)`.
 *  Vite replaces __RELEASE__ at build time, so the code is tree-shaken out of release bundles entirely. */
export const isRelease = __RELEASE__;
export const appVersion = __APP_VERSION__;
