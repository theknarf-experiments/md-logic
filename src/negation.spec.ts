import test from 'node:test';
import assert from 'node:assert';
import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term
} from './datalog';

const v = (n: string): Variable   => ({ type: 'variable', name: n });
const s = (x: string): StringConst => ({ type: 'string',  value: x });

test('negation incremental-add bug', () => {
  const nodes: Record<string, Node> = {
    /* s(X) :- p(X), not q(X).   -- evaluated first */
    s: predicate(
      [v('X')],
      [[
        { relation: 'p', terms: [v('X')] },
        { relation: 'q', terms: [v('X')], negated: true }
      ]]
    ),

    /* q(X) :- p(X).             -- evaluated second */
    q: predicate(
      [v('X')],
      [[{ relation: 'p', terms: [v('X')] }]]
    ),

    /* base p/1                  -- evaluated last */
    p: relation([[s('a')]])
  };

  const program = evaluate({ nodes, computed: {} });
  const sFacts = program.computed['s']?.facts ?? [];

  /* BUG: with add-only incremental evaluation we keep s(a) */
  assert.strictEqual(sFacts.length, 0, 's(a) should not survive');
});
