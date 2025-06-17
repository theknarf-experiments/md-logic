import moo from 'moo';

const lexer = moo.compile({
  ws: { match: /[ \t\n\r]+/, lineBreaks: true },
  comment: /%.*?$/,
  arrow: ':-',
  not: 'not',
  true_lit: 'true',
  false_lit: 'false',
  comma: ',',
  lparen: '(',
  rparen: ')',
  dot: '.',
  variable: /[A-Z][A-Za-z0-9_]*/,
  identifier: /[a-z][A-Za-z0-9_]*/,
  string: /"(?:\\.|[^\"])*"|'(?:\\.|[^'])*'/,
});

lexer.next = ((next) => () => {
  let tok;
  while ((tok = next.call(lexer))) {
    if (tok.type !== 'ws' && tok.type !== 'comment') return tok as any;
  }
})(lexer.next);

export default lexer;
