import { Parser, Grammar } from 'nearley';
import grammar from './datalog-grammar';
import lexer from './lexer';
import {
  Program,
  Node,
  relation,
  predicate,
  isRelation,
  isPredicate,
  Variable,
  Clause,
  Term,
} from './index';

interface FactStmt { type: 'fact'; name: string; terms: Term[]; }
interface RuleStmt { type: 'rule'; name: string; args: string[]; clauses: Clause[]; }
type Stmt = FactStmt | RuleStmt;

/**
 * Parses a Datalog program string using the generated Nearley grammar.
 *
 * The resulting {@link Program} contains all relations and predicates
 * defined in the input but has an empty {@code computed} table. The
 * program should be validated with {@link validate} and can then be
 * evaluated with {@link evaluate}.
 *
 * @param input - Source code of the Datalog program
 * @returns The parsed program
 * @throws If the parser fails to produce a valid result
 */
export function parseProgram(input: string): Program {
  const parser = new Parser(Grammar.fromCompiled(grammar as any));
  parser.feed(input);
  const results = parser.results as Stmt[][];
  if (results.length === 0) throw new Error('Parse error');
  const stmts = results[0];
  const nodes: Record<string, Node> = {};

  for (const st of stmts) {
    if (st.type === 'fact') {
      if (!nodes[st.name]) nodes[st.name] = relation([st.terms]);
      else if (isRelation(nodes[st.name])) (nodes[st.name] as any).facts.push(st.terms);
      else throw new Error(`Predicate and relation name conflict: ${st.name}`);
    } else {
      const args = st.args.map(n => ({ type: 'variable', name: n }) as Variable);
      if (!nodes[st.name]) nodes[st.name] = predicate(args, [st.clauses]);
      else if (isPredicate(nodes[st.name])) (nodes[st.name] as any).rules.push(st.clauses);
      else throw new Error(`Predicate and relation name conflict: ${st.name}`);
    }
  }

  return { nodes, computed: {} };
}
