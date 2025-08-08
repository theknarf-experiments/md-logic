export type Variable = { type: "variable", name: string };
export type StringConst = { type: "string", value: string };
export type BoolConst = { type: "boolean", value: boolean };

export type Term = Variable | StringConst | BoolConst;

export interface Clause {
  relation: string;
  terms: Term[];
  negated?: boolean; // optional negation
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
export function relation(facts: Fact[]): Relation {
  return {
    type: "Relation",
    facts
  };
}

export function predicate(args: Variable[], rules: Clause[][]): Predicate {
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

export function isPredicate(node: Node): node is Predicate {
  return node.type === "Predicate";
}

export function isRelation(node: Node): node is Relation {
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
export function evaluate(program: Program): Program {
  const newComputed: Record<string, Relation> = { ...program.computed };
  let changed = true;
  let iterations = 0;
  const MAX_ITERATIONS = 1000;

  while (changed && iterations < MAX_ITERATIONS) {
    iterations++;
    changed = false;

    for (const [name, node] of Object.entries(program.nodes)) {
      if (!isPredicate(node)) continue;

      const scratch: Fact[] = [];

      // Evaluate rules sequentially so new facts are visible immediately
      for (const rule of node.rules) {
        let bindings: Record<string, Term>[] = [{}];

        for (const clause of rule) {
          const rel = newComputed[clause.relation] ?? program.nodes[clause.relation];
          if (!rel || !isRelation(rel)) { bindings = []; break; }

          if (clause.negated) {
            bindings = bindings.filter(b => !rel.facts.some(row => unify(clause.terms, row, b)));
          } else {
            bindings = bindings.flatMap(b => {
              return rel.facts.reduce((acc: Record<string, Term>[], row) => {
                const u = unify(clause.terms, row, b);
                if (u) acc.push(u);
                return acc;
              }, []);
            });
          }
          if (bindings.length === 0) break; // early exit
        }

        // project bindings to facts
        for (const b of bindings) {
          const fact = node.args.map(v => b[v.name]);
          if (fact.every(x => x !== undefined) &&
              !scratch.some(f => JSON.stringify(f) === JSON.stringify(fact))) {
            scratch.push(fact as Fact);
          }
        }
      }

      const old = newComputed[name]?.facts ?? [];
      const diff = scratch.length !== old.length || scratch.some((f,i)=>JSON.stringify(f)!==JSON.stringify(old[i]));
      if (diff) {
        newComputed[name] = relation(scratch);
        changed = true;
      }
    }
  }

  if (iterations === MAX_ITERATIONS) {
    throw new Error("Exceeded maximum number of iterations, possible infinite loop");
  }

  return { nodes: program.nodes, computed: newComputed };
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

	out += "Inferred statements:\n\n";

	Object.entries(program.computed).forEach(([name, rel]) => {
		rel.facts.forEach(fact => {
			out += `${name}(${fact.map(t => ('value' in t ? t.value : t.name)).join(', ')})\n`;
		});
	});

  return out;
}

// Barrel export for consumers
export { parseProgram } from './parse';
