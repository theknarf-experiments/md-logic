import test from 'node:test';
import assert from 'node:assert';
import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
  unify, validate, Program, BoolConst
} from './index';

const v = (name: string): Variable => ({ type: "variable", name });
const s = (value: string): StringConst => ({ type: "string", value });
const b = (value: boolean): BoolConst => ({ type: "boolean", value });

test('ancestor rule', () => {
  const program: Program = {
    nodes: {
      parent: relation([
        [s("alice"), s("bob")],
        [s("bob"), s("charlie")],
        [s("charlie"), s("diana")]
      ]),
      ancestor: predicate([
        v("X"), v("Y")
      ], [
        [
          { relation: "parent", terms: [v("X"), v("Y")] }
        ],
        [
          { relation: "parent", terms: [v("X"), v("Z")] },
          { relation: "ancestor", terms: [v("Z"), v("Y")] }
        ]
      ])
    },
    computed: {}
  };

  validate(program);
  const evaluated = evaluate(program);

  const ancestorFacts = evaluated.computed["ancestor"].facts;

  assert.deepStrictEqual(
    new Set(ancestorFacts.map(fact => fact.map(t => (t.type === "string" ? t.value : "")).join("->"))),
    new Set([
      "alice->bob",
      "bob->charlie",
      "charlie->diana",
      "alice->charlie",
      "bob->diana",
      "alice->diana"
    ])
  );
});

test('unification', () => {
  const binding = unify([v("X"), v("Y")], [s("alice"), s("bob")], {});
  assert.deepStrictEqual(binding, { X: s("alice"), Y: s("bob") });

  const failBinding = unify([v("X"), s("bob")], [s("alice"), s("charlie")], {});
  assert.strictEqual(failBinding, null);

  const existingBinding = unify([v("X"), v("Y")], [s("alice"), s("bob")], { X: s("alice") });
  assert.deepStrictEqual(existingBinding, { X: s("alice"), Y: s("bob") });

  const conflictBinding = unify([v("X"), v("Y")], [s("alice"), s("bob")], { X: s("charlie") });
  assert.strictEqual(conflictBinding, null);
});

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
