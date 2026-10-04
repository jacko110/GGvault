# Dependency security review - 2026-10-03

Next.js and eslint-config-next in both frontends were upgraded from 14.2.15 to **15.5.27** after checking the official migration guide and security advisories. Cookie access and dynamic route parameters now use asynchronous APIs. The intermediate 14.2.35 patch did not resolve critical advisories; the supported 15.5 release removes those reported critical Next.js findings. Compatible `npm audit fix --ignore-scripts` changes were also applied without force. Builds and regression evidence are recorded in phase7-validation.md.

The final executed audit reports **0 critical, 51 high, 11 moderate and 4 low** package-graph findings (66 total), including development tooling. This is not proof of exploitability of every dependency in this application and not a clean audit. Remaining NestJS/platform-express/multipart runtime findings require a separately validated framework migration or documented operator risk decision before hosting a beta. **Do not expose this deployment to the open internet as a security-certified release.** Restrict any evaluated closed cohort through controlled ingress.

Primary references: [Next.js 15 migration guide](https://nextjs.org/docs/app/guides/upgrading/version-15), [Windows RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36), [Next.js advisories](https://github.com/vercel/next.js/security/advisories). Package-specific references below come from the executed npm audit. A registry proposed target is a candidate, not a tested safe version claim.

Runtime review: bearer authorization lives in Nest guards and domain services, not middleware alone; evidence uploads require authorization before parsing and have byte/field limits. These reduce exposure but do not erase upstream multipart/DoS advisories. No remote image patterns are configured and private evidence bypasses the optimizer. PostCSS findings affect build-time processing of trusted repository styles; untrusted CSS is not accepted. Jest/ESLint/CLI findings require toolchain upgrades, not exposure of development servers. Never use development servers for the beta.

| Package | Installed versions | Severity | Advisory references / inherited risk | Registry proposed fix | Disposition |
| --- | --- | --- | --- | --- | --- |
| @angular-devkit/core | 17.3.11 | high | ajv, chokidar, picomatch | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| @angular-devkit/schematics | 17.3.11 | moderate | @angular-devkit/core | compatible update reported | Remaining finding; deferred, review required |
| @angular-devkit/schematics-cli | 17.3.11 | moderate | @angular-devkit/core, @angular-devkit/schematics, inquirer | compatible update reported | Remaining finding; deferred, review required |
| @jest/console | 29.7.0 | high | jest-message-util | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/core | 29.7.0 | high | @jest/console, @jest/reporters, @jest/test-result, @jest/transform, jest-config, jest-haste-map, jest-message-util, jest-resolve, jest-resolve-dependencies, jest-runner, jest-runtime, jest-snapshot, jest-watcher, micromatch | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/environment | 29.7.0 | high | @jest/fake-timers | jest-environment-jsdom@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/expect | 29.7.0 | high | expect, jest-snapshot | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/fake-timers | 29.7.0 | high | jest-message-util | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/globals | 29.7.0 | high | @jest/environment, @jest/expect | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/reporters | 29.7.0 | high | @jest/console, @jest/test-result, @jest/transform, jest-message-util | compatible update reported | Remaining finding; deferred, review required |
| @jest/test-result | 29.7.0 | high | @jest/console | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/test-sequencer | 29.7.0 | high | @jest/test-result, jest-haste-map | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @jest/transform | 29.7.0 | high | jest-haste-map, micromatch | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| @nestjs/cli | 10.4.9 | high | @angular-devkit/core, @angular-devkit/schematics, @angular-devkit/schematics-cli, @nestjs/schematics, chokidar, fork-ts-checker-webpack-plugin, glob, inquirer, webpack | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| @nestjs/common | 10.4.22 | moderate | file-type | compatible update reported | Remaining finding; deferred, review required |
| @nestjs/core | 10.4.22 | moderate | @nestjs/platform-express, [GHSA-36xv-jgw5-4q75](https://github.com/advisories/GHSA-36xv-jgw5-4q75) | @nestjs/core@12.1.2 (major) | Remaining finding; deferred, review required |
| @nestjs/platform-express | 10.4.22 | high | @nestjs/core, body-parser, multer | @nestjs/platform-express@12.1.2 (major) | Remaining finding; deferred, review required |
| @nestjs/schematics | 10.2.3 | moderate | @angular-devkit/core, @angular-devkit/schematics | @nestjs/schematics@12.0.6 (major) | Remaining finding; deferred, review required |
| @nestjs/swagger | 7.4.2 | moderate | @nestjs/core, js-yaml, lodash | @nestjs/swagger@12.0.2 (major) | Remaining finding; deferred, review required |
| @nestjs/testing | 10.4.22 | moderate | @nestjs/core, @nestjs/platform-express | @nestjs/testing@12.1.2 (major) | Remaining finding; deferred, review required |
| @next/eslint-plugin-next | 15.5.27 | high | fast-glob | eslint-config-next@14.2.35 (major) | Remaining finding; deferred, review required |
| @types/jest | 29.5.14 | high | expect | @types/jest@30.0.0 (major) | Remaining finding; deferred, review required |
| @typescript-eslint/eslint-plugin | 7.18.0 | high | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils | @typescript-eslint/eslint-plugin@8.71.0 (major) | Remaining finding; deferred, review required |
| @typescript-eslint/parser | 7.18.0 | high | @typescript-eslint/typescript-estree | @typescript-eslint/parser@8.71.0 (major) | Remaining finding; deferred, review required |
| @typescript-eslint/type-utils | 7.18.0 | high | @typescript-eslint/typescript-estree, @typescript-eslint/utils | @typescript-eslint/eslint-plugin@8.71.0 (major) | Remaining finding; deferred, review required |
| @typescript-eslint/typescript-estree | 7.18.0 | high | globby | @typescript-eslint/parser@8.71.0 (major) | Remaining finding; deferred, review required |
| @typescript-eslint/utils | 7.18.0 | high | @typescript-eslint/typescript-estree | @typescript-eslint/eslint-plugin@8.71.0 (major) | Remaining finding; deferred, review required |
| ajv | 8.12.0 | moderate | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| babel-jest | 29.7.0 | high | @jest/transform | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| body-parser | 1.20.4 | low | [GHSA-v422-hmwv-36x6](https://github.com/advisories/GHSA-v422-hmwv-36x6) | @nestjs/platform-express@12.1.2 (major) | Remaining finding; deferred, review required |
| braces | 3.0.3 | high | [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| chokidar | 3.6.0 | high | braces | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| create-jest | 29.7.0 | high | jest-config | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| eslint-config-next | 15.5.27 | high | @next/eslint-plugin-next | eslint-config-next@14.2.35 (major) | Remaining finding; deferred, review required |
| expect | 29.7.0 | high | jest-message-util | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| external-editor | 3.1.0 | low | tmp | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| fast-glob | 3.3.1, 3.3.3 | high | micromatch | eslint-config-next@14.2.35 (major) | Remaining finding; deferred, review required |
| file-type | 20.4.1 | moderate | [GHSA-5v7r-6r5c-r473](https://github.com/advisories/GHSA-5v7r-6r5c-r473), [GHSA-j47w-4g3g-c36v](https://github.com/advisories/GHSA-j47w-4g3g-c36v) | compatible update reported | Remaining finding; deferred, review required |
| fork-ts-checker-webpack-plugin | 9.0.2 | high | chokidar | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| glob | 10.4.5 | high | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| globby | 11.1.0 | high | fast-glob | @typescript-eslint/parser@8.71.0 (major) | Remaining finding; deferred, review required |
| inquirer | 9.2.15, 8.2.6 | low | external-editor | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| jest | 29.7.0 | high | @jest/core, jest-cli | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-circus | 29.7.0 | high | @jest/environment, @jest/expect, @jest/test-result, jest-message-util, jest-runtime, jest-snapshot | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-cli | 29.7.0 | high | @jest/core, @jest/test-result, create-jest, jest-config | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-config | 29.7.0 | high | @jest/test-sequencer, babel-jest, jest-circus, jest-environment-node, jest-resolve, jest-runner, micromatch | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-environment-jsdom | 29.7.0 | high | @jest/environment, @jest/fake-timers | jest-environment-jsdom@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-environment-node | 29.7.0 | high | @jest/environment, @jest/fake-timers | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-haste-map | 29.7.0 | high | micromatch | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-message-util | 29.7.0 | high | micromatch | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-resolve | 29.7.0 | high | jest-haste-map | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-resolve-dependencies | 29.7.0 | high | jest-snapshot | compatible update reported | Remaining finding; deferred, review required |
| jest-runner | 29.7.0 | high | @jest/console, @jest/environment, @jest/test-result, @jest/transform, jest-environment-node, jest-haste-map, jest-message-util, jest-resolve, jest-runtime, jest-watcher | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-runtime | 29.7.0 | high | @jest/environment, @jest/fake-timers, @jest/globals, @jest/test-result, @jest/transform, jest-haste-map, jest-message-util, jest-resolve, jest-snapshot | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-snapshot | 29.7.0 | high | @jest/transform, expect, jest-message-util | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| jest-watcher | 29.7.0 | high | @jest/test-result | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| js-yaml | 4.1.0 | high | [GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m), [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68), [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m), [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj), [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) | @nestjs/swagger@12.0.2 (major) | Remaining finding; deferred, review required |
| lodash | 4.17.21 | high | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc), [GHSA-f23m-r3pf-42rh](https://github.com/advisories/GHSA-f23m-r3pf-42rh), [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | @nestjs/swagger@12.0.2 (major) | Remaining finding; deferred, review required |
| micromatch | 4.0.8 | high | braces | jest@30.5.2 (major) | Remaining finding; deferred, review required |
| multer | 2.0.2 | high | [GHSA-xf7r-hgr6-v32p](https://github.com/advisories/GHSA-xf7r-hgr6-v32p), [GHSA-v52c-386h-88mc](https://github.com/advisories/GHSA-v52c-386h-88mc), [GHSA-5528-5vmv-3xc2](https://github.com/advisories/GHSA-5528-5vmv-3xc2), [GHSA-72gw-mp4g-v24j](https://github.com/advisories/GHSA-72gw-mp4g-v24j), [GHSA-3p4h-7m6x-2hcm](https://github.com/advisories/GHSA-3p4h-7m6x-2hcm), [GHSA-wc9g-mqfw-jrwm](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm), [GHSA-qvfw-j98x-7q72](https://github.com/advisories/GHSA-qvfw-j98x-7q72), [GHSA-535w-7cp7-47q4](https://github.com/advisories/GHSA-535w-7cp7-47q4) | @nestjs/platform-express@12.1.2 (major) | Remaining finding; deferred, review required |
| next | 15.5.27 | moderate | postcss | next@16.3.8 (major) | Remaining finding; deferred, review required |
| picomatch | 4.0.1 | high | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| postcss | 8.4.31 | high | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93), [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q), [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) | next@16.3.8 (major) | Remaining finding; deferred, review required |
| qs | 6.14.2 | moderate | [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26), [GHSA-x5fp-wj9c-mxmx](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx), [GHSA-4mjr-xmp4-gh2g](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g) | compatible update reported | Remaining finding; deferred, review required |
| tmp | 0.0.33 | high | [GHSA-52f5-9888-hmc6](https://github.com/advisories/GHSA-52f5-9888-hmc6), [GHSA-ph9p-34f9-6g65](https://github.com/advisories/GHSA-ph9p-34f9-6g65) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
| webpack | 5.97.1 | low | [GHSA-8fgc-7cc6-rx7x](https://github.com/advisories/GHSA-8fgc-7cc6-rx7x), [GHSA-38r7-794h-5758](https://github.com/advisories/GHSA-38r7-794h-5758) | @nestjs/cli@12.0.8 (major) | Remaining finding; deferred, review required |
