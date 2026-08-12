import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aboutText,
  docsListText,
  documentationTopics,
  documentationUrl,
  handleHelpCenterCommand,
  resolveDocumentationTopic,
  shortcutsText,
} from '../src/help-center.js';

test('documentation topics resolve canonical names and aliases', () => {
  assert.equal(resolveDocumentationTopic('install').key, 'installation');
  assert.equal(resolveDocumentationTopic('doctor').key, 'troubleshooting');
  assert.equal(resolveDocumentationTopic('oidc').key, 'trusted-publishing');
  assert.equal(resolveDocumentationTopic('cookies').key, 'cookies');
  assert.equal(resolveDocumentationTopic('missing-topic'), null);
});

test('documentation URLs use the canonical 1.7.5 release branch', () => {
  assert.match(documentationUrl('faq'), /andhikamarcella\/YTConv\/blob\/release\/ytconv-1\.7\.5\/cli\/docs\/FAQ\.md$/u);
  assert.match(documentationUrl('index'), /andhikamarcella\/YTConv\/tree\/release\/ytconv-1\.7\.5\/cli\/docs$/u);
  assert.match(documentationUrl('donate'), /cli\/docs\/DONATE\.md$/u);
});

test('help-center panels are responsive and discoverable', () => {
  assert.match(aboutText(50), /YTConv 1\.7\.5/u);
  assert.match(aboutText(90), /help\.ytconv@proton\.me/u);
  assert.match(shortcutsText(50), /Ctrl\+M/u);
  assert.match(docsListText(90), /installation/u);
  let migrationText = '';
  const migrationOutput = handleHelpCenterCommand(['docs', 'migration'], {
    write: (value) => { migrationText = value; },
    columns: 50,
  });
  assert.equal(migrationOutput.topic, 'migration');
  assert.match(migrationText, /https:\/\/github\.com\/andhikamarcella\/YTConv\/blob\/release\/ytconv-1\.7\.5\/cli\/docs\/MIGRATION-1\.7\.5\.md/u);
  assert.doesNotMatch(migrationText, /…/u);
  assert.ok(documentationTopics().length >= 24);
});

test('command handler supports docs, about, shortcuts, and unknown topics', () => {
  const output = [];
  assert.deepEqual(handleHelpCenterCommand(['about'], { write: (value) => output.push(value), columns: 60 }).exitCode, 0);
  assert.equal(handleHelpCenterCommand(['shortcuts'], { write: (value) => output.push(value), columns: 60 }).handled, true);
  assert.equal(handleHelpCenterCommand(['docs', 'faq'], { write: (value) => output.push(value), columns: 60 }).topic, 'faq');
  assert.equal(handleHelpCenterCommand(['docs', 'does-not-exist'], { write: (value) => output.push(value), columns: 60 }).exitCode, 2);
  assert.equal(handleHelpCenterCommand(['download'], { write: (value) => output.push(value) }).handled, false);
});
