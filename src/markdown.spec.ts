import test   from 'node:test';
import assert from 'node:assert/strict';
import { mdToDoc } from './markdown';
import { Doc } from './document';

test('markdown → Doc', () => {
  const md = `
import backlog from './backlog.md';

- [x] Postgres is an open source database
- [x] Postgres is free
- [ ] Postgres works with Node.js

- We decided to go for Postgres
  - \`1 & 2 & 3\`
- We'll add a task to the backlog
  - \`4 & $backlog\`
`;

  const expected: Doc = {
    name: 'db-decition',
    import: ['backlog'],
    assumptions: [
      { id: 1, value: true , text: 'Postgres is an open source database' },
      { id: 2, value: true , text: 'Postgres is free' },
      { id: 3, value: false, text: 'Postgres works with Node.js' }
    ],
    infer: [
      { id: 4, text: 'We decided to go for Postgres', dependsOn: [1,2,3] },
      { id: 5, text: "We'll add a task to the backlog", dependsOn: [4,'backlog'] }
    ]
  };

  const got = mdToDoc(md, 'db-decition.md');
  assert.deepStrictEqual(got, expected);
});
