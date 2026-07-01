import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMaintenance } from '../src/lib/maintenance.js';

test('maintenance parser clamps unsafe values and tolerates invalid JSON', () => {
  const state = parseMaintenance({ MAINTENANCE_MODE: 'true', MAINTENANCE_PROGRESS: '999', MAINTENANCE_ETA_MINUTES: '1231241248', MAINTENANCE_STEPS_JSON: '[bad' });
  assert.equal(state.active, true);
  assert.equal(state.progress, 100);
  assert.equal(state.etaMinutes, null);
  assert.deepEqual(state.steps, []);
});
