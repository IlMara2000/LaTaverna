import test from 'node:test';
import assert from 'node:assert/strict';
import { readJsonBody } from '../../api/_lib/http.js';

test('JSON requests must be objects, including pre-parsed bodies', async () => {
  for (const body of ['null', '[]', '42', '"hello"', [], 42]) {
    await assert.rejects(readJsonBody({body}), e => e.statusCode === 400);
  }
  assert.deepEqual(await readJsonBody({body:'{"prompt":"ciao"}'}), {prompt:'ciao'});
  await assert.rejects(readJsonBody({body:{text:'x'.repeat(100)}}, 20), e => e.statusCode === 413);
});
