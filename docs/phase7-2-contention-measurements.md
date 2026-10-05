# Phase 7.2 operation measurements

Generated from retained local lab reports; all required repetitions are included. The first run below is diagnostic BEFORE; the next three are final acceptance; the last is the optional 50-flow observation. No raw users, logs, backups or runtime artifacts are included.

## Run 7b816e9133

Flows: 20; arrival: 0 ms; requests: 150; failed flows: 13; unexpected errors: 9.33%; duration: 9.649 s.

HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.

| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create | 20 / 20 | 61 / 20 | 41 | 0 | 0 / 0 / 0 / 0 | 41 / 0 | 268.56 / 808.26 / 887.83 | 41.78 / 82.67 / 88.39 |
| join | 20 / 20 | 52 / 20 | 32 | 0 | 0 / 0 / 0 / 0 | 32 / 0 | 128.46 / 1015.46 / 1514.19 | 39.74 / 106.63 / 150.60 |
| fund_a | 20 / 14 | 108 / 14 | 94 | 0 | 0 / 0 / 0 / 0 | 88 / 6 | 717.47 / 4516.85 / 4651.21 | 79.12 / 216.23 / 245.06 |
| fund_b | 20 / 14 | 128 / 14 | 114 | 0 | 0 / 0 / 0 / 0 | 108 / 6 | 1466.97 / 5024.09 / 5154.22 | 78.69 / 215.50 / 233.43 |
| ready_a | 9 / 9 | 13 / 9 | 4 | 0 | 0 / 0 / 0 / 0 | 4 / 0 | 83.49 / 545.38 / 545.38 | 53.87 / 116.86 / 116.86 |
| ready_b | 9 / 9 | 16 / 9 | 7 | 0 | 0 / 0 / 0 / 0 | 7 / 0 | 176.46 / 272.65 / 272.65 | 55.87 / 110.46 / 110.46 |
| result | 9 / 9 | 14 / 9 | 5 | 0 | 0 / 0 / 0 / 0 | 5 / 0 | 102.97 / 846.16 / 846.16 | 38.48 / 81.26 / 81.26 |
| confirm | 9 / 7 | 53 / 7 | 46 | 0 | 0 / 0 / 0 / 0 | 44 / 2 | 3511.54 / 5051.01 / 5051.01 | 85.43 / 263.51 / 279.89 |

Settlement suboperation instrumentation was not present in this earlier experiment; do not infer its duration from confirmation.

| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |
| --- | --- | --- |

Financial invariants: `{"ok":true,"globalConservation":"0","transactions":98,"invalidTransactions":0,"negativeBalances":0,"duplicateOrMixedOutcomes":0,"overfilledChallenges":0}`.

Query error surfaces (not proof of the causal row):

| Operation / model.action | Calls | P2034 | Total elapsed ms |
| --- | --- | --- | --- |
| fund_b LedgerAccount.upsert | 256 | 33 | 2239.53 |
| create Challenge.create | 61 | 30 | 630.87 |
| fund_a LedgerAccount.upsert | 216 | 29 | 1747.70 |
| fund_b LedgerTransaction.create | 89 | 29 | 885.95 |
| fund_a LedgerTransaction.create | 75 | 23 | 744.32 |
| confirm Match.update | 126 | 17 | 642.06 |
| join Challenge.findUnique | 88 | 13 | 596.42 |
| fund_a Challenge.findUnique | 277 | 12 | 1725.26 |
| fund_b Challenge.findUnique | 321 | 12 | 1980.66 |
| fund_b ChallengePlayer.update | 60 | 9 | 208.84 |
| join ChallengePlayer.create | 52 | 7 | 141.53 |
| ready_b Match.update | 23 | 7 | 253.17 |
| confirm Match.findUnique | 86 | 7 | 1920.63 |
| create AuditLog.create | 31 | 6 | 100.98 |
| fund_b LedgerEntry.findMany | 95 | 6 | 298.17 |
| fund_b Challenge.update | 34 | 6 | 126.16 |
| join Challenge.update | 45 | 5 | 130.81 |
| fund_a ChallengePlayer.update | 52 | 5 | 168.87 |
| confirm AuditLog.create | 61 | 5 | 321.69 |
| join AuditLog.create | 40 | 4 | 102.06 |
| fund_a LedgerEntry.findMany | 79 | 4 | 236.02 |
| fund_b AuditLog.create | 56 | 4 | 160.22 |
| fund_a AuditLog.create | 46 | 4 | 139.51 |
| fund_a Challenge.findUniqueOrThrow | 10 | 4 | 65.42 |
| confirm MatchResult.findUnique | 26 | 4 | 168.86 |
| confirm LedgerAccount.upsert | 60 | 4 | 740.67 |
| fund_a ChallengePlayer.findMany | 47 | 3 | 138.30 |
| fund_b Challenge.findUniqueOrThrow | 20 | 3 | 98.66 |
| fund_b Match.create | 17 | 3 | 155.47 |
| ready_a Match.update | 16 | 3 | 103.55 |
| confirm Match.findUniqueOrThrow | 10 | 3 | 255.64 |
| fund_a LedgerAccount.findUnique | 38 | 2 | 211.18 |
| fund_b MatchEvent.create | 14 | 2 | 43.48 |
| fund_a Challenge.update | 18 | 2 | 69.46 |
| fund_a Match.create | 6 | 2 | 82.06 |
| result Match.update | 24 | 2 | 90.82 |
| result MatchResult.create | 12 | 2 | 68.94 |
| confirm MatchResult.update | 49 | 2 | 324.08 |
| confirm Challenge.update | 46 | 2 | 237.37 |
| fund_b ChallengePlayer.findMany | 51 | 1 | 150.13 |
| fund_b LedgerAccount.findUnique | 41 | 1 | 216.91 |
| fund_b Match.findUnique | 21 | 1 | 62.58 |
| ready_a AuditLog.create | 13 | 1 | 50.58 |
| result Challenge.update | 10 | 1 | 43.24 |
| confirm Dispute.findUnique | 22 | 1 | 133.78 |
| confirm LedgerTransaction.create | 13 | 1 | 252.65 |
## Run 8fb4d4a786

Flows: 20; arrival: 0 ms; requests: 220; failed flows: 0; unexpected errors: 0.00%; duration: 9.063 s.

HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.

| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 308.22 / 1344.33 / 1368.75 | 288.63 / 1189.85 / 1213.13 |
| join | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 326.92 / 768.75 / 827.40 | 271.60 / 683.39 / 716.44 |
| fund_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1341.73 / 2543.80 / 2668.97 | 936.26 / 2110.31 / 2114.55 |
| fund_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1457.87 / 2628.73 / 2751.31 | 1011.67 / 2211.96 / 2323.91 |
| ready_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 884.90 / 1381.35 / 1575.01 | 704.36 / 1139.56 / 1144.80 |
| ready_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 967.65 / 1321.17 / 1605.70 | 698.19 / 1052.69 / 1172.86 |
| result | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 735.93 / 1046.49 / 1407.13 | 441.41 / 905.09 / 1113.94 |
| confirm | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 881.40 / 2025.41 / 2359.60 | 800.33 / 1541.00 / 1882.05 |
| settlement (nested) | No separate HTTP endpoint | 20 / 20 body returns | 0 | 0 | 0 internal errors; HTTP attributed to confirm | No independent retry; parent confirm above | N/A | 62.84 / 92.83 / 96.38 |

| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |
| --- | --- | --- |
| create | 92.25 / 465.24 / 718.50 | 22.67 / 43.70 / 45.16 |
| join | 91.16 / 420.73 / 421.64 | 26.28 / 40.21 / 44.36 |
| fund_a | 266.22 / 1228.99 / 1320.04 | 61.51 / 93.07 / 106.18 |
| fund_b | 271.76 / 1237.73 / 1265.63 | 79.95 / 122.69 / 133.35 |
| ready_a | 520.38 / 848.44 / 986.86 | 21.19 / 53.47 / 56.33 |
| ready_b | 486.59 / 860.61 / 989.17 | 30.73 / 54.98 / 55.52 |
| result | 358.00 / 729.56 / 1043.80 | 26.86 / 39.66 / 45.41 |
| confirm | 661.05 / 1192.48 / 1198.57 | 104.13 / 143.68 / 144.46 |

Financial invariants: `{"ok":true,"globalConservation":"0","transactions":123,"invalidTransactions":0,"negativeBalances":0,"duplicateOrMixedOutcomes":0,"overfilledChallenges":0}`.

## Run 8c33fc2be8

Flows: 20; arrival: 0 ms; requests: 220; failed flows: 0; unexpected errors: 0.00%; duration: 9.123 s.

HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.

| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 330.39 / 1439.05 / 1478.74 | 311.39 / 1247.56 / 1251.56 |
| join | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 366.87 / 753.35 / 780.15 | 279.18 / 656.88 / 667.61 |
| fund_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1519.23 / 2395.56 / 2509.31 | 947.27 / 2156.19 / 2231.45 |
| fund_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1373.79 / 2476.74 / 2593.91 | 1020.60 / 2038.71 / 2324.98 |
| ready_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1045.59 / 1307.72 / 1623.48 | 731.92 / 1124.62 / 1226.89 |
| ready_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1094.09 / 1430.17 / 1657.37 | 785.89 / 1163.97 / 1258.89 |
| result | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 767.61 / 1284.50 / 1312.56 | 431.94 / 1217.62 / 1243.86 |
| confirm | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 907.01 / 1999.22 / 2325.19 | 782.35 / 1477.29 / 1490.90 |
| settlement (nested) | No separate HTTP endpoint | 20 / 20 body returns | 0 | 0 | 0 internal errors; HTTP attributed to confirm | No independent retry; parent confirm above | N/A | 57.85 / 84.20 / 88.14 |

| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |
| --- | --- | --- |
| create | 106.20 / 468.22 / 702.51 | 24.18 / 42.80 / 43.71 |
| join | 100.84 / 391.80 / 393.94 | 29.28 / 41.19 / 42.05 |
| fund_a | 311.49 / 1101.38 / 1170.37 | 65.89 / 113.37 / 140.36 |
| fund_b | 305.54 / 1107.83 / 1120.97 | 80.72 / 122.52 / 134.78 |
| ready_a | 526.86 / 871.21 / 1011.70 | 21.39 / 41.73 / 43.22 |
| ready_b | 524.72 / 862.10 / 1012.46 | 31.05 / 56.04 / 57.34 |
| result | 362.98 / 971.87 / 976.51 | 27.31 / 31.94 / 32.15 |
| confirm | 637.26 / 1078.23 / 1195.31 | 99.59 / 132.41 / 137.93 |

Financial invariants: `{"ok":true,"globalConservation":"0","transactions":123,"invalidTransactions":0,"negativeBalances":0,"duplicateOrMixedOutcomes":0,"overfilledChallenges":0}`.

## Run 388b8faa8d

Flows: 20; arrival: 0 ms; requests: 220; failed flows: 0; unexpected errors: 0.00%; duration: 8.972 s.

HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.

| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 319.36 / 1328.18 / 1340.47 | 301.12 / 1259.03 / 1284.79 |
| join | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 334.11 / 747.40 / 751.53 | 266.01 / 690.03 / 717.36 |
| fund_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1493.66 / 2455.67 / 2577.58 | 897.77 / 1955.69 / 1996.46 |
| fund_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1574.27 / 2543.45 / 2661.37 | 975.83 / 2047.40 / 2115.05 |
| ready_a | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 895.81 / 1207.33 / 1240.48 | 701.41 / 1097.99 / 1117.93 |
| ready_b | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 942.07 / 1300.65 / 1357.40 | 708.96 / 1130.48 / 1148.91 |
| result | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 725.08 / 1148.70 / 1175.51 | 418.13 / 1097.29 / 1121.41 |
| confirm | 20 / 20 | 20 / 20 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 849.55 / 2224.89 / 2726.59 | 784.60 / 1760.43 / 1854.05 |
| settlement (nested) | No separate HTTP endpoint | 20 / 20 body returns | 0 | 0 | 0 internal errors; HTTP attributed to confirm | No independent retry; parent confirm above | N/A | 62.43 / 94.47 / 107.41 |

| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |
| --- | --- | --- |
| create | 103.70 / 469.53 / 483.25 | 22.88 / 43.52 / 43.77 |
| join | 93.61 / 405.58 / 413.86 | 27.95 / 37.92 / 40.75 |
| fund_a | 267.34 / 1268.84 / 1324.35 | 63.54 / 95.18 / 128.70 |
| fund_b | 259.56 / 1212.67 / 1273.99 | 79.40 / 116.18 / 118.26 |
| ready_a | 508.69 / 913.34 / 918.13 | 20.42 / 43.37 / 55.65 |
| ready_b | 525.25 / 843.66 / 931.95 | 29.84 / 54.65 / 55.05 |
| result | 342.01 / 864.94 / 868.82 | 26.11 / 29.33 / 32.95 |
| confirm | 661.27 / 1042.83 / 1070.30 | 104.06 / 144.61 / 164.06 |

Financial invariants: `{"ok":true,"globalConservation":"0","transactions":123,"invalidTransactions":0,"negativeBalances":0,"duplicateOrMixedOutcomes":0,"overfilledChallenges":0}`.

## Run 4783b9dbf4

Flows: 50; arrival: 0 ms; requests: 550; failed flows: 0; unexpected errors: 0.00%; duration: 20.857 s.

HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.

| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| create | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 742.22 / 6417.93 / 6465.28 | 600.70 / 3387.47 / 4104.12 |
| join | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 1138.84 / 3379.42 / 3665.38 | 714.04 / 2047.21 / 2090.33 |
| fund_a | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 3804.33 / 6463.81 / 6771.22 | 2355.91 / 4487.49 / 4764.78 |
| fund_b | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 3721.00 / 6543.74 / 6685.54 | 2434.04 / 4549.39 / 4854.66 |
| ready_a | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 3355.44 / 4470.64 / 4517.63 | 1199.34 / 2703.22 / 2779.98 |
| ready_b | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 3401.59 / 4499.71 / 4543.09 | 1225.80 / 2731.70 / 2809.71 |
| result | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 2199.46 / 4002.95 / 4068.01 | 1495.21 / 2652.22 / 2677.65 |
| confirm | 50 / 50 | 50 / 50 | 0 | 0 | 0 / 0 / 0 / 0 | 0 / 0 | 3377.74 / 4244.45 / 4390.93 | 2186.39 / 2755.71 / 2831.52 |
| settlement (nested) | No separate HTTP endpoint | 50 / 50 body returns | 0 | 0 | 0 internal errors; HTTP attributed to confirm | No independent retry; parent confirm above | N/A | 56.29 / 70.95 / 97.53 |

| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |
| --- | --- | --- |
| create | 74.77 / 881.82 / 912.73 | 22.23 / 35.40 / 37.74 |
| join | 89.72 / 462.54 / 499.88 | 25.76 / 52.19 / 52.92 |
| fund_a | 875.11 / 1132.75 / 1191.62 | 62.97 / 91.98 / 120.00 |
| fund_b | 886.79 / 1148.92 / 1217.99 | 79.81 / 117.26 / 122.59 |
| ready_a | 354.32 / 989.75 / 1275.42 | 20.60 / 33.00 / 34.82 |
| ready_b | 351.99 / 905.40 / 1203.26 | 28.70 / 42.12 / 44.32 |
| result | 391.40 / 1080.30 / 1255.86 | 24.63 / 29.49 / 30.61 |
| confirm | 912.62 / 1275.51 / 1288.68 | 95.07 / 116.54 / 150.99 |

Financial invariants: `{"ok":true,"globalConservation":"0","transactions":273,"invalidTransactions":0,"negativeBalances":0,"duplicateOrMixedOutcomes":0,"overfilledChallenges":0}`.
