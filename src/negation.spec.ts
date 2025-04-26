import test from 'node:test';
import assert from 'node:assert';
import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
	Program, validate
} from './datalog';

const v = (name: string): Variable => ({ type: 'variable', name });
const s = (value: string): StringConst => ({ type: 'string', value });

// --- Negation test: a succeeds when p(X) and not q(X)
test('negation predicate', () => {

  const program: Program = {
    nodes: {
      p: relation([[s('a')], [s('b')]]),
      q: relation([[s('b')]]),
      a: predicate([v('X')], [
        [
          { relation: 'p', terms: [v('X')] },
          { relation: 'q', terms: [v('X')], negated: true }
        ]
      ])
    },
    computed: {}
  };

	validate(program);
  const result = evaluate(program).computed['a'].facts;
  assert.deepStrictEqual(result.map(f => f.map(t => ('value' in t ? t.value : t.name)).join()), ['a']);
});

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
