param([Parameter(Mandatory = $true)][ValidatePattern('^[1-9][0-9]{0,2}(?:-[1-9][0-9]{0,2})?[a-z]?$')][string]$Phase)
$ErrorActionPreference = 'Stop'
$reviewWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location $reviewWorkspace
try {
  $env:GG_REVIEW_PHASE = [string]$Phase
  @'
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHash, randomUUID } = require('node:crypto');
const phase = process.env.GG_REVIEW_PHASE;
if (!/^[1-9][0-9]{0,2}(?:-[1-9][0-9]{0,2})?[a-z]?$/.test(phase)) throw new Error('Invalid phase');
const git = args => execFileSync('git', args, { maxBuffer: 32 * 1024 * 1024 });
if (git(['status', '--porcelain']).toString().trim()) throw new Error('Commit all phase source changes before packaging');
git(['rev-parse', 'HEAD~1']);
const commit = git(['rev-parse', 'HEAD']).toString().trim();
const tracked = git(['ls-tree', '-r', '--name-only', 'HEAD']).toString().trim().split('\n');
const forbidden = f => f.split('/').some(p => /^(node_modules|\.next|dist|coverage|playwright-report|test-results|\.git|logs?|storage|backups|secrets|\.aws|tmp|temp|build|out|\.cache|\.npm|\.turbo|\.swc|\.parcel-cache|\.nyc_output)$/i.test(p) || (/^\.env(?:\.|$)/i.test(p) && p !== '.env.example')) || /(?:\.pem|\.key|\.dump|\.backup|\.log|\.tmp|\.temp|\.tsbuildinfo|\.zip|\.patch|next-env\.d\.ts|\.eslintcache|\.stylelintcache)$/i.test(f);
if (tracked.some(forbidden)) throw new Error('Forbidden tracked files: ' + tracked.filter(forbidden).join(', '));
const changed = new Set(git(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD~1', 'HEAD']).toString().trim().split('\n'));
const source = /\.(?:ts|tsx|js|jsx|cjs|mjs|json|css|scss|md|sql|prisma|toml|yml|yaml|ps1|base64)$/;
const selected = tracked.filter(f =>
  (changed.has(f) && source.test(f)) ||
  /^apps\/api\/test\//.test(f) || /^apps\/(web|admin)\/tests\//.test(f) ||
  /^packages\/database\/prisma\//.test(f) ||
  /^scripts\/.*\.(?:cjs|ps1)$/.test(f) || /^load-tests\/.*\.(?:cjs|md)$/.test(f) ||
  /^docs\//.test(f) ||
  /^deploy\/(?:Dockerfile|compose\.beta\.yml|nginx\.conf\.template|\.env\.example|[a-z-]+\.(?:cjs|sh|md))$/.test(f) ||
  /(^|\/)package\.json$/.test(f) ||
  ['package-lock.json','docker-compose.yml','.env.example','.gitignore','.gitattributes','.dockerignore','AGENTS.md','README.md'].includes(f));
const stage = path.resolve('.cache', 'reviews', randomUUID());
fs.mkdirSync(stage, { recursive: true });
const files = [];
function add(name, bytes) {
  if (forbidden(name) && !new RegExp(`^phase${phase}\\.patch$`).test(name)) throw new Error('Forbidden review path: ' + name);
  if (!/^[A-Za-z0-9_.\/()\[\]-]+$/.test(name) || name.split('/').includes('..')) throw new Error('Unsafe review path');
  const target = path.join(stage, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
  files.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
}
for (const f of selected.sort()) add(f, git(['show', `HEAD:${f}`]));
const reports = [
  [`phase${phase}.patch`, ['diff', 'HEAD~1', 'HEAD']],
  [`phase${phase}-stat.txt`, ['diff', '--stat', 'HEAD~1', 'HEAD']],
  [`phase${phase}-commit.txt`, ['log', '-1', '--stat']],
];
for (const [name, args] of reports) { const bytes = git(args); fs.writeFileSync(name, bytes); add(name, bytes); }
fs.writeFileSync(`.cache/phase${phase}-review-plan.json`, JSON.stringify({ commit, stage, archive: path.resolve(`GGvault-phase${phase}-review.zip`), files }, null, 2));
console.log(`Staged ${files.length} source/review files from ${commit}`);
'@ | node
  if ($LASTEXITCODE -ne 0) { throw 'Source staging failed' }
  $reviewPlanPath = Join-Path $reviewWorkspace ".cache/phase$Phase-review-plan.json"
  $reviewPlan = Get-Content -Raw -LiteralPath $reviewPlanPath | ConvertFrom-Json
  $reviewStage = [IO.Path]::GetFullPath($reviewPlan.stage)
  $reviewStagingRoot = [IO.Path]::GetFullPath((Join-Path $reviewWorkspace '.cache/reviews')) + [IO.Path]::DirectorySeparatorChar
  if (-not $reviewStage.StartsWith($reviewStagingRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unsafe staging directory' }
  $reviewArchive = Join-Path $reviewWorkspace "GGvault-phase$Phase-review.zip"
  if (Test-Path -LiteralPath $reviewArchive) { throw 'Archive already exists; inspect/remove the previous deliverable before regenerating' }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $reviewWriter = [IO.Compression.ZipFile]::Open($reviewArchive, [IO.Compression.ZipArchiveMode]::Create)
  try {
    foreach ($reviewFile in $reviewPlan.files) {
      $sourcePath = Join-Path $reviewStage $reviewFile.name
      [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($reviewWriter, $sourcePath, $reviewFile.name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
  } finally { $reviewWriter.Dispose() }
  $reviewZip = [IO.Compression.ZipFile]::OpenRead($reviewArchive)
  try {
    if ($reviewZip.Entries.Count -ne $reviewPlan.files.Count) { throw 'Unexpected archive member count' }
    foreach ($reviewFile in $reviewPlan.files) {
      $entry = $reviewZip.GetEntry($reviewFile.name)
      if ($null -eq $entry) { throw "Missing member: $($reviewFile.name)" }
      $stream = $entry.Open()
      $hash = [Security.Cryptography.SHA256]::Create()
      try { $actual = ([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
      finally { $hash.Dispose(); $stream.Dispose() }
      if ($actual -ne $reviewFile.sha256) { throw "Committed content mismatch: $($reviewFile.name)" }
    }
  } finally { $reviewZip.Dispose() }
  # The absolute path was checked against this workspace's dedicated staging root above.
  Remove-Item -LiteralPath $reviewStage -Recurse -Force
  Write-Output "Verified commit: $($reviewPlan.commit)"
  Write-Output "Verified members: $($reviewPlan.files.Count)"
  Write-Output "Review archive: $reviewArchive"
} finally {
  Remove-Item Env:\GG_REVIEW_PHASE -ErrorAction SilentlyContinue
  Pop-Location
}
