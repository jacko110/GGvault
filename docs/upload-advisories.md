# Phase 7.1 upload advisory mapping

The evidence path is browser -> exact-origin BFF -> private Nest API -> FileInterceptor/Multer memory buffer -> EvidencePolicy -> UUID private storage. JWT/account status, actor mutation throttle and match-participant guard run before the upload interceptor. A malicious admitted participant can still attack the parser: authentication is not an advisory fix.

## Parser exposure and fix

Phase 7 used vulnerable Multer 2.0.2. Phase 7.1 uses Nest platform-express 11.2.7's supported Multer 2.4.0. The fresh audit reports no Multer advisory for this version. [Upstream advisory list](https://github.com/expressjs/multer/security/advisories) and exact audit ranges were reviewed.

| Advisory class | Attack prerequisite on this path | Prior exposure / current control |
| --- | --- | --- |
| Malformed multipart/unclosed streams/incomplete abort cleanup | Authenticated participant sends malformed or aborted multipart | Memory storage still invokes the parser; authentication and file limits were insufficient. Patched Multer removes the audited affected versions. Edge timeouts/concurrency caps remain necessary. |
| Deep recursion, nested/crafted field names, oversized array indices | Participant crafts multipart field names, not necessarily a large file | Reached Multer field handling before DTO validation. Upgraded parser, fieldNameSize=32, one field and bounded parts; do not claim these limits alone replace the patch. |
| Async fileFilter size-limit race | Application must use asynchronous fileFilter | No custom async fileFilter is configured, so this prerequisite is absent; parser upgraded anyway. |
| file-type ASF loop / ZIP decompression | Application must call affected file-type parsers on attacker media | GGVault uses its own bounded header/container checks, not Nest FileTypeValidator or file-type decoding. Those parsers were not reached. New common dependency resolves patched file-type 21.3.4. |
| body-parser invalid size configuration | Invalid limit configuration disables enforcement | Not the multipart parser. No user-controlled body-parser limit; migrated body-parser 2.3.0 removes audited old version. BFF streaming JSON cap remains 8192 bytes. |

## Effective limits

API memory parser: one file, one field, three parts (Busboy boundary accounting), field value 32 bytes, field name 32 bytes, headerPairs configured to 32. Busboy's actual multipart header handling also has built-in limits; do not rely on headerPairs as proof of a tighter parser implementation. File byte cap is the larger of configured screenshot/video limits, both bounded by MAX_EVIDENCE_SIZE: default 10 MiB screenshot and 50 MiB video, hard configuration maximum 100 MiB. Screenshot-specific cap is checked after parsing. Concurrent buffers can multiply RAM use; proxy upload concurrency/body/time limits are required.

EvidencePolicy checks nonempty size, permitted type/MIME/extension agreement, bounded magic/container structure, filename length and control/path/HTML characters. Storage uses generated UUID keys and checks SHA-256 on read. It does not fully decode media or scan malware. Private viewing, nosniff, restricted media origins and moderator handling remain required. Evidence must be uploaded before opening a dispute under the existing domain deadline.

Regression coverage retains unexpected/multiple fields/files, byte limits, malformed/traversal names, spoofed MIME/container signatures, unauthorized actors, immutable storage and integrity checks. Phase 7.1 adds a field-name bound and verifies the patched runtime through complete regression and the clean evidence/VOID smoke. Remote proxy resource-limit enforcement is an operator deployment gate, not something local parser tests prove.
