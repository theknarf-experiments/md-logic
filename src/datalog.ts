export type Variable = { type: "variable", name: string };
export type StringConst = { type: "string", value: string };
export type BoolConst = { type: "boolean", value: boolean };

export type Term = Variable | StringConst | BoolConst;

export interface Clause {
  relation: string;
  terms: Term[];
}

export interface Predicate {
  type: "Predicate";
  args: Variable[];
  rules: Clause[][];
}

export type Fact = Term[];

export interface Relation {
  type: "Relation";
  facts: Fact[];
}

export type Node = Predicate | Relation;

export interface Program {
  nodes: Record<string, Node>;
  computed: Record<string, Relation>;
}

// Node constructors
function relation(facts: Fact[]): Relation {
  return {
    type: "Relation",
    facts
  };
}

function predicate(args: Variable[], rules: Clause[][]): Predicate {
  return {
    type: "Predicate",
    args,
    rules
  };
}

// Validation
export function validate(program: Program): void {
  const names = new Set(Object.keys(program.nodes));

    // Evaluate each predicate
    Object.entries(program.nodes).forEach(([name, node]) => {
    if (isPredicate(node)) {
      // Apply each rule of the predicate
      node.rules.forEach(rule => {
        const seenVars = new Set<string>();

        // Sequentially apply each clause in the rule to extend bindings
        rule.forEach(clause => {
          if (!names.has(clause.relation)) {
            throw new Error(`Unknown relation '${clause.relation}' in predicate '${name}'`);
          }

          clause.terms.forEach(term => {
            if (term.type === 'variable') {
              seenVars.add(term.name);
            }
          });
        });

        node.args.forEach(arg => {
          if (arg.type === 'variable' && !seenVars.has(arg.name)) {
            throw new Error(`Head variable '${arg.name}' is not properly bound in predicate '${name}'`);
          }
        });
      });
    }
  });
}

function isPredicate(node: Node): node is Predicate {
  return node.type === "Predicate";
}

function isRelation(node: Node): node is Relation {
  return node.type === "Relation";
}

/**
 * Fully evaluates a Datalog program until no new facts are generated.
 * 
 * It repeatedly applies all predicate rules and merges newly derived facts
 * into the computed relations, iterating until a fixpoint is reached.
 * 
 * @param program The input program containing relations and predicates.
 * @returns A new Program with computed results populated.
 */
function evaluate(program: Program): Program {
  const newComputed: Record<string, Relation> = { ...program.computed };

  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  // Outer fixpoint loop: keep running until no new facts are added
  while (changed && iterations < MAX_ITERATIONS) {
    iterations++;
    changed = false;

    Object.entries(program.nodes).forEach(([name, node]) => {
      if (!isPredicate(node)) return;

      const oldFacts = newComputed[name]?.facts ?? [];
      const newFacts: Fact[] = [];

      node.rules.forEach(rule => {
        let bindings = [{} as Record<string, Term>];

        rule.forEach(clause => {
          // Lookup in computed relations first, then base nodes
          const relation = newComputed[clause.relation] ?? program.nodes[clause.relation];
          if (!relation || !isRelation(relation)) return;

          // For each current binding, attempt to unify against clause facts
          bindings = bindings.flatMap(binding => {
            return relation.facts.reduce((acc, row) => {
              const unified = unify(clause.terms, row, binding);
              if (unified) acc.push(unified);
              return acc;
            }, [] as Record<string, Term>[]);
          });
        });

        // Project the bindings onto the predicate's argument order
        bindings.forEach(binding => {
          const projected = node.args.map(v => binding[v.name]);
          if (projected.every(x => x !== undefined)) {
            const old = newComputed[name]?.facts ?? [];
            const exists = old.some(fact => JSON.stringify(fact) === JSON.stringify(projected));
            if (!exists) {
              newComputed[name] = relation([...old, projected]);
              changed = true;
            }
          }
        });
      });
    });
  }

  if (iterations === MAX_ITERATIONS) {
    throw new Error("Exceeded maximum number of iterations, possible infinite loop");
  }

  return {
    nodes: program.nodes,
    computed: newComputed
  };
}

export function unify(pattern: Term[], row: Term[], binding: Record<string, Term>): Record<string, Term> | null {
  const newBinding = { ...binding };

  for (let i = 0; i < pattern.length; i++) {
    const pat = pattern[i];
    const val = row[i];

    if (pat.type === 'variable') {
      if (newBinding[pat.name] !== undefined) {
        const bound = newBinding[pat.name];
        if (!bound || bound.type !== val.type || ('value' in bound && 'value' in val && bound.value !== val.value)) {
          return null;
        }
      } else {
        newBinding[pat.name] = val;
      }
    } else if (pat.type !== val.type || ('value' in pat && 'value' in val && pat.value !== val.value)) {
      return null;
    }
  }

  return newBinding;
}

// --- Tests using Node's test runner ---
import test from 'node:test';
import assert from 'node:assert';

test('ancestor rule', () => {
  const v = (name: string): Variable => ({ type: "variable", name });
  const s = (value: string): StringConst => ({ type: "string", value });
  const b = (value: boolean): BoolConst => ({ type: "boolean", value });
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
  const v = (name: string): Variable => ({ type: "variable", name });
  const s = (value: string): StringConst => ({ type: "string", value });
  const b = (value: boolean): BoolConst => ({ type: "boolean", value });
  const binding = unify([v("X"), v("Y")], [s("alice"), s("bob")], {});
  assert.deepStrictEqual(binding, { X: s("alice"), Y: s("bob") });

  const failBinding = unify([v("X"), s("bob")], [s("alice"), s("charlie")], {});
  assert.strictEqual(failBinding, null);

  const existingBinding = unify([v("X"), v("Y")], [s("alice"), s("bob")], { X: s("alice") });
  assert.deepStrictEqual(existingBinding, { X: s("alice"), Y: s("bob") });

  const conflictBinding = unify([v("X"), v("Y")], [s("alice"), s("bob")], { X: s("charlie") });
  assert.strictEqual(conflictBinding, null);
});



// --- Example integration: Document-based inference ---

// Document definitions
interface DocAssumption { id: string | number; value: boolean; text: string; }
interface DocInference { id: string | number; text: string; dependsOn: Array<string | number>; }
interface Doc { name: string; import?: string[]; assumptions: DocAssumption[]; infer: DocInference[]; }

/**
 * Builds a Datalog program from high-level documents.
 */
function buildProgram(docs: Doc[]): Program {
  const nodes: Record<string, Node> = {};

  // Helper constructors
  const v = (name: string | number): Variable => ({ type: 'variable', name: name.toString() });
  const s = (value: string | number): StringConst => ({ type: 'string', value: value.toString() });
  const b = (value: boolean): BoolConst => ({ type: 'boolean', value });

  // equal(Name)
  nodes['equal'] = relation(
    [
      [b(true), b(true)]
    ]
  );

  // doc(Name)
  nodes['doc'] = relation(
    docs.map(doc => [s(doc.name)])
  );

  // assumption(Doc, Id, Value)
  nodes['assumption'] = relation(
    docs.flatMap(doc =>
       doc.assumptions.map(a => [s(doc.name), s(a.id.toString()), b(a.value)])
    )
  );

  // inference(Doc, Id)
  nodes['inference'] = relation(
    docs.flatMap(doc =>
       doc.infer.map(inf => [s(doc.name), s(inf.id)])
    )
  );

  // inference_dependsOn(Doc, Id, Assumption-Id or Doc-Name)
  nodes['inference_dependsOn'] = relation(
    docs.flatMap(doc =>
       doc.infer.flatMap(inf =>
         inf.dependsOn
            .map(dep => [s(doc.name), s(inf.id), s(dep)])
       )
    )
  );

  nodes['inference_check'] = predicate(
    [ v('Doc'), v('Id'), /*v('DependOnId'),*/ v('Value') ],
    [
      // Check inference rules that depends on assumptions
      [
        { relation: 'doc', terms: [ v('Doc') ] },
        { relation: 'inference', terms: [ v('Doc'), v('Id') ] },
        { relation: 'inference_dependsOn', terms: [ v('Doc'), v('Id'), v('DependOnId') ] },
        { relation: 'assumption', terms: [ v('Doc'), v('DependOnId'), v('Value') ] },
      ],
      // Check inference rules that depends on other inference checks
      [
        { relation: 'doc', terms: [ v('Doc') ] },
        { relation: 'inference', terms: [ v('Doc'), v('Id') ] },
        { relation: 'inference_dependsOn', terms: [ v('Doc'), v('Id'), v('DependOnId') ] },
        { relation: 'inference', terms: [ v('Doc'), v('DependOnId') ] },
        { relation: 'inference_check', terms: [ v('Doc'), v('DependOnId'), v('Value') ] },
      ],
      // Check inference rules that depends on docs
      [
        { relation: 'doc', terms: [ v('Doc') ] },
        { relation: 'inference', terms: [ v('Doc'), v('Id') ] },
        { relation: 'inference_dependsOn', terms: [ v('Doc'), v('Id'), v('DependOnId') ] },
        { relation: 'doc', terms: [ v('DependOnId') ] },
        { relation: 'doc_check', terms: [ v('DependOnId'), v('Value') ] },
      ],
    ]
  );

  nodes['doc_check'] = predicate(
    [ v('Doc'), /*v('Assumption'),*/ v('Value') ],
    [
      [
        { relation: 'doc', terms: [ v('Doc') ] },
        { relation: 'assumption', terms: [ v('Doc'), v('Assumption'), v('Value') ] },
      ]

    ]
  );

  return { nodes, computed: {} };
}

/**
 * Returns a Datalog-like string representation of the program.
 */
export function prettyPrint(program: Program): string {
  let out = '';
  for (const [name, node] of Object.entries(program.nodes)) {
    if (isRelation(node)) {
      node.facts.forEach(fact => {
        const vals = fact.map(t => ('value' in t ? t.value : t.name)).join(', ');
        out += `${name}(${vals})${"\n"}`;
      });
    } else {
      const args = node.args.map(v => v.name).join(', ');
      node.rules.forEach(rule => {
        const body = rule.map(clause => {
          const terms = clause.terms.map(t => ('value' in t ? t.value : t.name)).join(', ');
          return `${clause.relation}(${terms})`;
        }).join(", \n\t");
        out += `${name}(${args}) :- ${"\n\t"}${body}.${"\n\n"}`;
      });
    }
    out += "\n";
  }
  return out;
}

// Example documents
const doc0: Doc = {
  name: 'backlog',
  assumptions: [ { id: 1, value: true, text: 'We use Jira for our backlog' } ],
  infer: []
};

const doc1: Doc = {
  name: 'db-decition',
  import: ['global-assumptions'],
  assumptions: [
    { id: 1, value: true, text: 'Postgres is an open source database' },
    { id: 2, value: true, text: 'Postgres is free' },
    { id: 3, value: false, text: 'Postgres works with Node.js' }
  ],
  infer: [
    { id: 4, text: 'We decided to go for Postgres', dependsOn: [1,2,3] },
    { id: 5, text: "We'll add a task to the backlog", dependsOn: [4, 'backlog'] }
  ]
};

// Build, evaluate, and inspect results
const program = buildProgram([doc0, doc1]);

console.log(prettyPrint(program));

validate(program);
const evaluated = evaluate(program);

console.log('Inferred statements:');

Object.entries(evaluated.computed).forEach(([name, rel]) => {
  rel.facts.forEach(fact => {
    console.log(`${name}(${fact.map(t => ('value' in t ? t.value : t.name)).join(', ')})`);
  });
});

// Currently the inferred result will show true if all infered cases are true & false if all are false,
// and have results for both true and false if only a part of the inference check is correct
// that means we need to check the result afterwards looking for mixed results to indicate a negative inference
