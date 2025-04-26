import test from 'node:test';
import assert from 'node:assert';
import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
  unify, validate, Program, BoolConst
} from './datalog';

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
