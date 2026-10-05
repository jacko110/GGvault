const fs = require('node:fs');
const { spawn } = require('node:child_process');
function secret(name) {
  const value = fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
  if (value.length < 32 || /replace|placeholder|<|>/i.test(value))
    throw new Error('Invalid deployment secret');
  return value;
}
try {
  const env = { ...process.env, NODE_ENV: 'production' };
  if (
    process.env.GGVAULT_SERVICE === 'api' ||
    process.env.GGVAULT_SERVICE === 'operations'
  ) {
    env.JWT_SECRET = secret('jwt_secret');
    const database = env.ISOLATED_RESTORE_DATABASE || env.POSTGRES_DB;
    if (
      env.ISOLATED_RESTORE_DATABASE &&
      !require('../scripts/beta-backup.cjs').isolated(database, env.POSTGRES_DB)
    )
      throw new Error('Invalid isolated database');
    env.DATABASE_URL = `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(secret('db_password'))}@postgres:5432/${encodeURIComponent(database)}`;
  }
  env.REDIS_URL = `redis://:${encodeURIComponent(secret('redis_password'))}@redis:6379`;
  env.WEB_REDIS_URL = env.REDIS_URL;
  const [command, ...args] = process.argv.slice(2);
  if (!command) throw new Error('Missing process command');
  const child = spawn(command, args, { env, stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.on(signal, () => child.kill(signal));
  child.on('error', () => {
    console.error('Deployment process failed');
    process.exitCode = 1;
  });
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
} catch {
  console.error(
    'Deployment configuration rejected; check secret references and service configuration.',
  );
  process.exitCode = 1;
}
