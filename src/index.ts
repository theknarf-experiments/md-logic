import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
  unify, validate, Program, BoolConst,
  isRelation, isPredicate, prettyPrint
} from './datalog';
import { Doc, buildProgram } from './document';

// Example documents
const doc0: Doc = {
  name: 'backlog',
  assumptions: [ { id: 1, value: false, text: 'We use Jira for our backlog' } ],
  infer: []
};

const doc1: Doc = {
  name: 'db-decition',
  import: ['global-assumptions'],
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

// Build, evaluate, and inspect results
const program = buildProgram([doc0, doc1]);

validate(program);
const evaluated = evaluate(program);

console.log(prettyPrint(evaluated));
