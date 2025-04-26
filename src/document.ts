import {
  relation, predicate, evaluate,
  Variable, StringConst, Node, Term,
  unify, validate, Program, BoolConst,
  isRelation, isPredicate
} from './datalog';

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

  // Currently the inferred result will show true if all infered cases are true & false if all are false,
  // and have results for both true and false if only a part of the inference check is correct
  // that means we need to check the result afterwards looking for mixed results to indicate a negative inference
	nodes['inference_check_mixed'] = predicate(
    [ v('Doc'), v('Id') ],
    [
      [
        { relation: 'inference_check', terms: [ v('Doc'), v('Id'), b(true) ] },
        { relation: 'inference_check', terms: [ v('Doc'), v('Id'), b(false) ] },
      ]
    ]
  );

  nodes['equal'] = relation(
    [
      [b(true), b(true)],
      [b(false), b(false)],
      [s('partial'), s('partial')],
    ]
  );

  nodes['inference_check_stratified'] = predicate(
    [ v('Doc'), v('Id'), v('Value') ],
    [
      // Check that matches if inference_check is true and no mixed case exists
      [
        { relation: 'inference_check', terms: [ v('Doc'), v('Id'), b(true) ] },
        { relation: 'inference_check_mixed', terms: [ v('Doc'), v('Id') ], negated: true },
        { relation: 'equal', terms: [ v('Value'), b(true) ] },
      ],
      // Check that matches if inference_check is false and no mixed case exists
      [
        { relation: 'inference_check', terms: [ v('Doc'), v('Id'), b(false) ] },
        { relation: 'inference_check_mixed', terms: [ v('Doc'), v('Id') ], negated: true },
        { relation: 'equal', terms: [ v('Value'), b(false) ] },
      ],
      // Check that matches if mixed case exists
      [
        { relation: 'inference_check_mixed', terms: [ v('Doc'), v('Id') ], },
        { relation: 'equal', terms: [ v('Value'), s('partial') ] },
      ],
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
          return `${clause.negated ? 'not ' : ''}${clause.relation}(${terms})`;
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

console.log(prettyPrint(program));

validate(program);
const evaluated = evaluate(program);

console.log('Inferred statements:');

Object.entries(evaluated.computed).forEach(([name, rel]) => {
  rel.facts.forEach(fact => {
    console.log(`${name}(${fact.map(t => ('value' in t ? t.value : t.name)).join(', ')})`);
  });
});

