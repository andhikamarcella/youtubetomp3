import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSemver, androidVersionCode } from '../src/semver.js';

test('validates semantic versions', () => {
  assert.equal(assertSemver('1.2.3'), '1.2.3');
  assert.throws(() => assertSemver('1.2'), /Invalid semantic version/u);
});

test('derives deterministic Android versionCode', () => {
  assert.equal(androidVersionCode('1.6.7'), 10607);
  assert.equal(androidVersionCode('12.34.56'), 123456);
});
