import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TOKEN_SIGNING_KEY = process.env.TOKEN_SIGNING_KEY || 'test-signing-key';
process.env.PROTECTED_ORIGIN = process.env.PROTECTED_ORIGIN || 'http://protected-origin';

const { parsePassphraseWordList, verifyPassphrase } = await import('./server.mjs');

test('parsePassphraseWordList accepts comma and newline separated words', () => {
  assert.deepEqual(parsePassphraseWordList('alpha, beta\n gamma\n delta '), ['alpha', 'beta', 'gamma', 'delta']);
});

test('verifyPassphrase accepts any word from the configured wordlist', async () => {
  const env = {
    PASSPHRASE_WORDLIST: 'alpha, Beta, gamma',
    PASSPHRASE_HASH: 'ignored-hash'
  };

  assert.equal(await verifyPassphrase('beta', env), true);
  assert.equal(await verifyPassphrase('delta', env), false);
});

test('verifyPassphrase keeps legacy hash validation working', async () => {
  assert.equal(await verifyPassphrase('devpass', { PASSPHRASE_HASH: '_uOcI4VuPZ3VAIYaMJA1SLiHiZQpGy_vf_8vU7MHPAw' }), true);
  assert.equal(await verifyPassphrase('wrongpass', { PASSPHRASE_HASH: '_uOcI4VuPZ3VAIYaMJA1SLiHiZQpGy_vf_8vU7MHPAw' }), false);
});
