// Temporary feature boundary for the reviewed Astro 5 advisory exceptions.
import { parse } from '@astrojs/compiler';
import ts from 'typescript';
import { readdir, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

export async function inspectAstro(source) {
  const { ast } = await parse(source);
  const findings = [];
  function visit(node) {
    for (const attr of node.attributes ?? []) {
      if (attr.kind === 'spread' || attr.name === 'define:vars' || attr.name.startsWith('transition:') || attr.name.startsWith('server:')) {
        findings.push(`Review required for ${attr.kind === 'spread' ? 'spread attributes' : attr.name}`);
      }
      if ((attr.name === 'slot' || (node.name === 'slot' && attr.name === 'name')) && !['quoted', 'empty'].includes(attr.kind)) {
        findings.push('Review required for dynamic slot names');
      }
    }
    if (node.type === 'frontmatter') {
      const file = ts.createSourceFile('frontmatter.ts', node.value, ts.ScriptTarget.Latest, true);
      function checkImport(item) {
        const specifier = ts.isImportDeclaration(item) || ts.isExportDeclaration(item) ? item.moduleSpecifier :
          ts.isCallExpression(item) && item.expression.kind === ts.SyntaxKind.ImportKeyword ? item.arguments[0] : undefined;
        if (specifier && ts.isStringLiteral(specifier) && /^(astro:assets|astro:transitions)(\/|$)/.test(specifier.text)) {
          findings.push(`Review required for ${specifier.text}`);
        }
        ts.forEachChild(item, checkImport);
      }
      checkImport(file);
    }
    for (const child of node.children ?? []) visit(child);
  }
  visit(ast);
  return findings;
}

async function checkDirectory(directory) {
  const findings = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) findings.push(...await checkDirectory(path));
    else if (entry.name.endsWith('.astro')) {
      findings.push(...(await inspectAstro(await readFile(path, 'utf8'))).map(message => `${path}: ${message}`));
    }
  }
  return findings;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const findings = await checkDirectory('src');
  if (findings.length) {
    console.error(findings.join('\n'));
    process.exitCode = 1;
  } else console.info('PASS: reviewed Astro feature boundary');
}
