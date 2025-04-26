import test from 'node:test';
import assert from 'node:assert';
import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
  unify, validate, Program, BoolConst,
  isRelation, isPredicate, prettyPrint
} from './datalog';
import { Doc, buildProgram } from './document';


test('document inference stratified status', () => {
  const v = (name: string): Variable => ({ type: 'variable', name });
  const s = (value: string): StringConst => ({ type: 'string', value });
  const b = (value: boolean): BoolConst => ({ type: 'boolean', value });

  const doc0: Doc = {
    name: 'backlog',
    assumptions: [ { id: 1, value: false, text: 'We use Jira for our backlog' } ],
    infer: []
  };

  const doc1: Doc = {
    name: 'db-decition',
    import: ['backlog'],
    assumptions: [
      { id: 1, value: true, text: 'Postgres is an open source database' },
      { id: 2, value: true, text: 'Postgres is free' },
      { id: 3, value: true, text: 'Postgres works with Node.js' }
    ],
    infer: [
      { id: 4, text: 'We decided to go for Postgres', dependsOn: [1,2,3] },
      { id: 5, text: "We'll add a task to the backlog", dependsOn: [4, 'backlog'] }
    ]
  };

  const prog = buildProgram([doc0, doc1]);
  validate(prog);
  const res = evaluate(prog);

  const facts = res.computed['inference_check_stratified']?.facts || [];
  const rendered = facts.map(f => f.map(t => ('value' in t ? t.value : t.name)).join('->'));

  assert.deepStrictEqual(
    new Set(rendered),
    new Set([
      'db-decition->4->true',
      'db-decition->5->partial'
    ])
  );
});
