/** Validated at startup and at policy reads. No secret values in errors. */
export function positiveInteger(
  name: string,
  fallback: number,
  max = 2147483647,
) {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > max
  )
    throw new Error(`Invalid ${name} configuration`);
  return value;
}

export function betaConfig() {
  if (process.env.NODE_ENV === 'production') {
    for (const [name, protocols] of [
      ['DATABASE_URL', ['postgres:', 'postgresql:']],
      ['REDIS_URL', ['redis:', 'rediss:']],
    ] as const) {
      try {
        const url = new URL(process.env[name] ?? '');
        if (!(protocols as readonly string[]).includes(url.protocol))
          throw new Error();
      } catch {
        throw new Error(`Invalid ${name} configuration`);
      }
    }
    if (
      !process.env.JWT_SECRET ||
      process.env.JWT_SECRET.startsWith('replace-') ||
      Buffer.byteLength(process.env.JWT_SECRET) < 32
    )
      throw new Error('Invalid JWT_SECRET configuration');
  }
  positiveInteger('INITIAL_TEST_CREDITS', 100);
  for (const name of ['BETA_MODE', 'ENABLE_TEST_CREDITS']) {
    if (
      process.env[name] !== undefined &&
      !['true', 'false'].includes(process.env[name]!)
    )
      throw new Error(`Invalid ${name} configuration`);
  }
  return {
    enabled: process.env.BETA_MODE === 'true',
    maxOpen: positiveInteger('MAX_OPEN_CHALLENGES_PER_USER', 5),
    maxDaily: positiveInteger('MAX_DAILY_CHALLENGES', 20),
    maxStake: positiveInteger('MAX_STAKE_TEST_CREDITS', 100),
    maxEvidence: positiveInteger('MAX_EVIDENCE_SIZE', 52428800, 104857600),
    mutationLimit: positiveInteger('MUTATION_RATE_LIMIT', 60, 10000),
  };
}
