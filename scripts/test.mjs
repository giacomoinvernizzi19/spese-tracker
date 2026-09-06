// Bundle TypeScript tests using the esbuild already supplied by Astro/Vite.
import { build } from 'esbuild';
import { readdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'thinkin-tests-'));
try {
  const files = (await readdir('tests')).filter(name => name.endsWith('.test.ts'));
  for (const name of files) {
    await build({ entryPoints: [`tests/${name}`], outfile: join(directory, name.replace('.ts', '.mjs')), bundle: true, platform: 'node', format: 'esm', external: ['miniflare'], logLevel: 'warning' });
  }
  const result = spawnSync(process.execPath, ['--test', ...files.map(name => join(directory, name.replace('.ts', '.mjs')))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}
