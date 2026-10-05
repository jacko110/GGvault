// Summarizes lab reports without including actors, credentials, IDs or raw rows.
const fs = require('node:fs');
function percentiles(values = []) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.5, 0.95, 0.99]
    .map((q) =>
      sorted.length
        ? sorted[Math.max(0, Math.ceil(sorted.length * q) - 1)].toFixed(2)
        : 'N/A',
    )
    .join(' / ');
}
function summarize(report) {
  const lines = [
    `## Run ${report.run}`,
    '',
    `Flows: ${report.results.load?.vus}; arrival: ${report.results.load?.arrivalMs} ms; requests: ${report.results.load?.requests}; failed flows: ${report.results.load?.failedFlows}; unexpected errors: ${((report.results.load?.errorRate ?? 0) * 100).toFixed(2)}%; duration: ${report.results.load?.seconds.toFixed(3)} s.`,
    '',
    'HTTP success counts are committed endpoint responses. Transaction attempts include rollbacks; suboperation success means its body returned, with final settlement committed only when confirmation succeeds. Latencies are milliseconds, nearest-rank p50 / p95 / p99.',
    '',
    '| Operation | HTTP attempts / success | Tx attempts / success | P2034 | P2028 | Other 409 / 429 / 5xx / network | Retries / exhausted | HTTP p50 / p95 / p99 | Tx p50 / p95 / p99 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const step of [
    'create',
    'join',
    'fund_a',
    'fund_b',
    'ready_a',
    'ready_b',
    'result',
    'confirm',
  ]) {
    const rows = (report.operationRequests ?? []).filter(
        (r) => r.step === step,
      ),
      tx = report.mixedTransactions?.[step];
    if (!tx) continue;
    const counts = [
      (r) => r.status === 409 && r.code !== 'TRANSACTION_RETRY',
      (r) => r.status === 429,
      (r) => r.status >= 500,
      (r) => r.status === 0,
    ]
      .map((predicate) => rows.filter(predicate).length)
      .join(' / ');
    lines.push(
      `| ${step} | ${rows.length} / ${rows.filter((r) => r.status >= 200 && r.status < 300).length} | ${tx.attempts} / ${tx.successes} | ${tx.conflicts} | ${tx.p2028} | ${counts} | ${tx.retries} / ${tx.exhausted} | ${percentiles(rows.map((r) => r.ms))} | ${percentiles(tx.durations)} |`,
    );
  }
  const stage = report.suboperations?.settlement;
  if (stage)
    lines.push(
      `| settlement (nested) | No separate HTTP endpoint | ${stage.attempts} / ${stage.successes} body returns | ${stage.p2034} | ${stage.p2028} | ${stage.otherErrors} internal errors; HTTP attributed to confirm | No independent retry; parent confirm above | N/A | ${percentiles(stage.durations)} |`,
    );
  else
    lines.push(
      '',
      'Settlement suboperation instrumentation was not present in this earlier experiment; do not infer its duration from confirmation.',
    );
  lines.push(
    '',
    '| Operation | Admission p50 / p95 / p99 | In-transaction work p50 / p95 / p99 |',
    '| --- | --- | --- |',
  );
  for (const [step, tx] of Object.entries(report.mixedTransactions ?? {}))
    if (tx.admissionMs?.length)
      lines.push(
        `| ${step} | ${percentiles(tx.admissionMs)} | ${percentiles(tx.workMs)} |`,
      );
  lines.push(
    '',
    'Financial invariants: `' +
      JSON.stringify(report.results.load?.invariant) +
      '`.',
    '',
  );
  const queries = Object.entries(report.queryOperations ?? {})
    .filter(([, q]) => q.errors.P2034)
    .sort((a, b) => b[1].errors.P2034 - a[1].errors.P2034);
  if (queries.length) {
    lines.push(
      'Query error surfaces (not proof of the causal row):',
      '',
      '| Operation / model.action | Calls | P2034 | Total elapsed ms |',
      '| --- | --- | --- | --- |',
    );
    for (const [name, q] of queries)
      lines.push(
        `| ${name} | ${q.count} | ${q.errors.P2034} | ${q.durationMs.toFixed(2)} |`,
      );
  }
  return lines.join('\n');
}
if (require.main === module)
  for (const filename of process.argv.slice(2))
    console.log(summarize(JSON.parse(fs.readFileSync(filename, 'utf8'))));
module.exports = { summarize, percentiles };
