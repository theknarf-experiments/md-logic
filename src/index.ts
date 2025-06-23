import fs from 'node:fs/promises';
import path from 'node:path';
import { glob } from 'glob';
import { buildProgram, Doc } from './document';
import { validate, evaluate, prettyPrint } from './datalog';
import { mdToDoc } from './markdown';

export async function runMarkdownPipeline(pattern = '**/*.logic.md'): Promise<void> {
  const files = await glob(pattern, { ignore: 'node_modules/**' });
  const docs: Doc[] = [];

  for (const file of files) {
    const md = await fs.readFile(file, 'utf8');
    docs.push(mdToDoc(md, path.basename(file)));
  }

  const program = buildProgram(docs);
  validate(program);
  const evaluated = evaluate(program);
  console.log(prettyPrint(evaluated));
}

runMarkdownPipeline('example/**/*.logic.md').catch(err => {
  console.error(err);
  process.exit(1);
});
