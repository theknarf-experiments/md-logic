#!/usr/bin/env -S node --import tsx
import readline from 'node:readline';
import { parseProgram, validate, evaluate, prettyPrint } from '@md-logic/datalog';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: 'datalog> ' });
let buffer = '';
rl.prompt();
rl.on('line', line => {
  if (line.trim() === '') {
    if (buffer.trim()) {
      try {
        const program = parseProgram(buffer);
        validate(program);
        const result = evaluate(program);
        console.log(prettyPrint(result));
      } catch (err) {
        console.error((err as Error).message);
      }
      buffer = '';
    }
  } else {
    buffer += line + '\n';
  }
  rl.prompt();
}).on('close', () => {
  process.exit(0);
});
