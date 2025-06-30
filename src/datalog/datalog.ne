@preprocessor typescript
@{% 
import lexer from './lexer';
%}
@lexer lexer

Program -> StatementList {% function(d){ return d[0]; } %}

StatementList -> Statement StatementList {% function(d){ return [d[0]].concat(d[1]); } %}
              | Statement {% function(d){ return [d[0]]; } %}

Statement -> Fact %dot {% function(d){ return d[0]; } %}
           | Rule %dot {% function(d){ return d[0]; } %}

Fact -> %identifier %lparen TermList %rparen {% function(d){ return {type:'fact', name:d[0].value, terms:d[2]}; } %}

Rule -> %identifier %lparen VarList %rparen %arrow ClauseList {% function(d){ return {type:'rule', name:d[0].value, args:d[2], clauses:d[5]}; } %}

ClauseList -> ClauseList %comma Clause {% function(d){ d[0].push(d[2]); return d[0]; } %}
           | Clause {% function(d){ return [d[0]]; } %}

Clause -> %not Atom {% function(d){ return {negated:true, relation:d[1].relation, terms:d[1].terms}; } %}
        | Atom {% function(d){ return d[0]; } %}

Atom -> %identifier %lparen TermList %rparen {% function(d){ return {relation:d[0].value, terms:d[2]}; } %}

VarList -> VarList %comma Var {% function(d){ d[0].push(d[2]); return d[0]; } %}
        | Var {% function(d){ return [d[0]]; } %}
Var -> %variable {% function(d){ return d[0].value; } %}

TermList -> TermList %comma Term {% function(d){ d[0].push(d[2]); return d[0]; } %}
         | Term {% function(d){ return [d[0]]; } %}
Term -> %variable {% function(d){ return {type:'variable', name:d[0].value}; } %}
      | %identifier {% function(d){ return {type:'string', value:d[0].value}; } %}
      | %string {% function(d){ return {type:'string', value:d[0].value.slice(1,-1)}; } %}
      | %true_lit {% function(d){ return {type:'boolean', value:true}; } %}
      | %false_lit {% function(d){ return {type:'boolean', value:false}; } %}
