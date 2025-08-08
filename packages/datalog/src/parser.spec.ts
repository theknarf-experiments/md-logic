import test from 'node:test';
import assert from 'node:assert/strict';
import lexer from './lexer';
import { parseProgram, evaluate, validate } from './index';

function tokens(input: string): string[] {
  lexer.reset(input);
  const ts = [] as string[];
  let t; while((t = lexer.next())) ts.push(t.type);
  return ts;
}

test('lexer basic tokens', () => {
  const got = tokens('parent(alice, bob).');
  assert.deepStrictEqual(got, ['identifier','lparen','identifier','comma','identifier','rparen','dot']);
});

test('parse and evaluate ancestor example', () => {
  const code = `\nparent(alice, bob).\nparent(bob, charlie).\nparent(charlie, diana).\nancestor(X,Y) :- parent(X,Y).\nancestor(X,Y) :- parent(X,Z), ancestor(Z,Y).\n`;
  const prog = parseProgram(code);
  validate(prog);
  const res = evaluate(prog).computed['ancestor'].facts.map(f=>f.map(t=>'value' in t ? t.value : t.name).join('->'));
  assert.deepStrictEqual(new Set(res), new Set(['alice->bob','bob->charlie','charlie->diana','alice->charlie','bob->diana','alice->diana']));
});

test('parse with negation', () => {
  const code = `\np(a).\np(b).\nq(b).\na(X) :- p(X), not q(X).\n`;
  const prog = parseProgram(code);
  validate(prog);
  const res = evaluate(prog).computed['a'].facts.map(f=>f.map(t=>'value' in t ? t.value : t.name).join());
  assert.deepStrictEqual(res, ['a']);
});
