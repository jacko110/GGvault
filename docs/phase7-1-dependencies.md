# Phase 7.1 dependency reachability review

Reviewed 2026-10-04. Before: 66 graph findings (51 high, 11 moderate, 4 low, zero critical). After explicit NestJS 11 migration: 58 (47 high, 8 moderate, 3 low, zero critical). Production-only audit: 4 graph findings (one high, three moderate); these are PostCSS/Next and js-yaml/Swagger. Counts are package graph findings, not independent exploitable vulnerabilities.

## Upgrade decision

Migrated on isolated branch `phase7-1-deployment-gate`, before integration into main: common/core/platform-express/testing 11.2.7, JWT 11.0.2, Swagger 11.4.7. Express 5.2.1, body-parser 2.3.0, Multer 2.4.0 and file-type 21.3.4 are resolved. This is one Nest major, not an unnecessary jump to 12. No force or legacy-peer-deps flags were used. The shared root common peer is pinned to the same API version because the old hoisted JWT peer retained Nest 10 and failed TypeScript compilation. A root override keeps that compatible peer aligned. Existing contracts and domain assertions must pass before integration.

The fresh audit has no entries for core, platform-express, multer, body-parser or file-type. See [Nest migration guidance](https://docs.nestjs.com/migration-guide) and [upstream Multer advisories](https://github.com/expressjs/multer/security/advisories). The current Nest guide describes newer majors; exact registry peer/dependency metadata determined the selected 11.x versions.

## Classification

A = runtime reachable; B = runtime package but advisory trigger not reachable in the current configuration; C = direct development/build dependency; D = transitive tooling. No remaining known audited A advisory was identified. This is code/configuration analysis, not proof that no unknown vulnerability exists.

PostCSS is in the production dependency graph but only processes repository-owned CSS during the build: no route accepts CSS/source maps and no user stylesheet/stringify endpoint exists. All PostCSS advisories are B for the deployed application, with trusted-source build exposure retained. Next’s advisory is inherited from PostCSS. js-yaml is used by Swagger to serialize the generated OpenAPI document, not to parse attacker YAML: its merge-key parser advisory is B. Keep Swagger private and never add user CSS/YAML processing without repeating this review.

Other rows are C/D and run in controlled development/CI. Restrict untrusted repositories, glob patterns, buildHttp sources and temporary-file locations. Deferred tooling major upgrades remain maintenance work.

| Package | Severity | Category | Resolved versions | Advisory or dependency cause |
| --- | --- | --- | --- | --- |
| @angular-devkit/core | high | D | 17.3.11 | ajv; chokidar; picomatch |
| @angular-devkit/schematics | moderate | D | 17.3.11 | @angular-devkit/core |
| @angular-devkit/schematics-cli | moderate | D | 17.3.11 | @angular-devkit/core; @angular-devkit/schematics; inquirer |
| @jest/console | high | D | 29.7.0 | jest-message-util |
| @jest/core | high | D | 29.7.0 | @jest/console; @jest/reporters; @jest/test-result; @jest/transform; jest-config; jest-haste-map; jest-message-util; jest-resolve; jest-resolve-dependencies; jest-runner; jest-runtime; jest-snapshot; jest-watcher; micromatch |
| @jest/environment | high | D | 29.7.0 | @jest/fake-timers |
| @jest/expect | high | D | 29.7.0 | expect; jest-snapshot |
| @jest/fake-timers | high | D | 29.7.0 | jest-message-util |
| @jest/globals | high | D | 29.7.0 | @jest/environment; @jest/expect |
| @jest/reporters | high | D | 29.7.0 | @jest/console; @jest/test-result; @jest/transform; jest-message-util |
| @jest/test-result | high | D | 29.7.0 | @jest/console |
| @jest/test-sequencer | high | D | 29.7.0 | @jest/test-result; jest-haste-map |
| @jest/transform | high | D | 29.7.0 | jest-haste-map; micromatch |
| @nestjs/cli | high | C | 10.4.9 | @angular-devkit/core; @angular-devkit/schematics; @angular-devkit/schematics-cli; @nestjs/schematics; chokidar; fork-ts-checker-webpack-plugin; glob; inquirer; webpack |
| @nestjs/schematics | moderate | C | 10.2.3 | @angular-devkit/core; @angular-devkit/schematics |
| @nestjs/swagger | moderate | B | 11.4.7 | js-yaml |
| @next/eslint-plugin-next | high | D | 15.5.27 | fast-glob |
| @types/jest | high | C | 29.5.14 | expect |
| @typescript-eslint/eslint-plugin | high | C | 7.18.0 | @typescript-eslint/parser; @typescript-eslint/type-utils; @typescript-eslint/utils |
| @typescript-eslint/parser | high | C | 7.18.0 | @typescript-eslint/typescript-estree |
| @typescript-eslint/type-utils | high | D | 7.18.0 | @typescript-eslint/typescript-estree; @typescript-eslint/utils |
| @typescript-eslint/typescript-estree | high | D | 7.18.0 | globby |
| @typescript-eslint/utils | high | D | 7.18.0 | @typescript-eslint/typescript-estree |
| ajv | moderate | D | 8.12.0 | [ajv has ReDoS when using `$data` option](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) |
| babel-jest | high | D | 29.7.0 | @jest/transform |
| braces | high | D | 3.0.3 | [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| chokidar | high | D | 3.6.0 | braces |
| create-jest | high | D | 29.7.0 | jest-config |
| eslint-config-next | high | C | 15.5.27 | @next/eslint-plugin-next |
| expect | high | D | 29.7.0 | jest-message-util |
| external-editor | low | D | 3.1.0 | tmp |
| fast-glob | high | D | 3.3.1, 3.3.3 | micromatch |
| fork-ts-checker-webpack-plugin | high | D | 9.0.2 | chokidar |
| glob | high | D | 10.4.5 | [glob CLI: Command injection via -c/--cmd executes matches with shell:true](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) |
| globby | high | D | 11.1.0 | fast-glob |
| inquirer | low | D | 9.2.15, 8.2.6 | external-editor |
| jest | high | C | 29.7.0 | @jest/core; jest-cli |
| jest-circus | high | D | 29.7.0 | @jest/environment; @jest/expect; @jest/test-result; jest-message-util; jest-runtime; jest-snapshot |
| jest-cli | high | D | 29.7.0 | @jest/core; @jest/test-result; create-jest; jest-config |
| jest-config | high | D | 29.7.0 | @jest/test-sequencer; babel-jest; jest-circus; jest-environment-node; jest-resolve; jest-runner; micromatch |
| jest-environment-jsdom | high | C | 29.7.0 | @jest/environment; @jest/fake-timers |
| jest-environment-node | high | D | 29.7.0 | @jest/environment; @jest/fake-timers |
| jest-haste-map | high | D | 29.7.0 | micromatch |
| jest-message-util | high | D | 29.7.0 | micromatch |
| jest-resolve | high | D | 29.7.0 | jest-haste-map |
| jest-resolve-dependencies | high | D | 29.7.0 | jest-snapshot |
| jest-runner | high | D | 29.7.0 | @jest/console; @jest/environment; @jest/test-result; @jest/transform; jest-environment-node; jest-haste-map; jest-message-util; jest-resolve; jest-runtime; jest-watcher |
| jest-runtime | high | D | 29.7.0 | @jest/environment; @jest/fake-timers; @jest/globals; @jest/test-result; @jest/transform; jest-haste-map; jest-message-util; jest-resolve; jest-snapshot |
| jest-snapshot | high | D | 29.7.0 | @jest/transform; expect; jest-message-util |
| jest-watcher | high | D | 29.7.0 | @jest/test-result |
| js-yaml | moderate | B | 5.3.0 | [js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) |
| micromatch | high | D | 4.0.8 | braces |
| next | moderate | B | 15.5.27 | postcss |
| picomatch | high | D | 4.0.1 | [Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching](https://github.com/advisories/GHSA-3v7f-55p6-f55p); [Picomatch has a ReDoS vulnerability via extglob quantifiers](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) |
| postcss | high | B | 8.4.31 | [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93); [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q); [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp); [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849) |
| qs | moderate | D | 6.14.2 | [qs has a remotely triggerable DoS: qs.stringify crashes with TypeError on null/undefined entries in comma-format arrays when encodeValuesOnly is set](https://github.com/advisories/GHSA-q8mj-m7cp-5q26); [qs array-limit bypass via bracket-key comma parsing](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx); [qs: Denial of Service via Attacker Controlled isBuffer](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) |
| tmp | high | D | 0.0.33 | [tmp allows arbitrary temporary file / directory write via symbolic link `dir` parameter](https://github.com/advisories/GHSA-52f5-9888-hmc6); [tmp has Path Traversal via unsanitized prefix/postfix that enables directory escape](https://github.com/advisories/GHSA-ph9p-34f9-6g65) |
| webpack | low | D | 5.97.1 | [webpack buildHttp: allowedUris allow-list bypass via URL userinfo (@) leading to build-time SSRF behavior](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x); [webpack buildHttp HttpUriPlugin allowedUris bypass via HTTP redirects → SSRF + cache persistence](https://github.com/advisories/GHSA-38r7-794h-5758) |
