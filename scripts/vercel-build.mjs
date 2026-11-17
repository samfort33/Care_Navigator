import { spawnSync } from 'node:child_process';

const isProduction = process.env.VERCEL_ENV === 'production';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (isProduction) {
  const directUrl = process.env.DATABASE_URL ?? '';
  const pooledUrl = process.env.DATABASE_URL_POOLED ?? '';
  if (!/^postgres(?:ql)?:\/\//i.test(directUrl) || !/^postgres(?:ql)?:\/\//i.test(pooledUrl)) {
    throw new Error('Production deployment requires direct DATABASE_URL and pooled DATABASE_URL_POOLED values.');
  }
  run(npx, ['prisma', 'migrate', 'deploy', '--schema=prisma/postgres/schema.prisma']);
}

run(npm, ['run', 'build']);
