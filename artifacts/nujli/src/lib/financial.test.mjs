// Run: node --test src/lib/financial.test.mjs  (Node >= 22.6 strips TS types)
// DOMParser is unavailable in Node, so XML decoding is verified in the browser pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KIND_LABEL, KIND_EXPLAIN, decodeFinancial, parseXmlSnippet, fmtAmount, fmtDay, entryDate, pickHeadline } from './financial.ts';

test('plain labels', () => {
  assert.equal(KIND_LABEL.received, 'Money received');
  assert.equal(KIND_LABEL.transferred, 'Money transferred');
  assert.equal(KIND_LABEL.spent, 'Money spent');
  assert.equal(KIND_LABEL.budget, 'Reported budget');
  assert.equal(KIND_LABEL.reported, 'Reported transaction');
});
test('short definitions carry no codes or jargon', () => {
  for (const v of Object.values(KIND_EXPLAIN)) assert.doesNotMatch(v, /IATI|code|type \d|disbursement|expenditure/i);
  assert.match(KIND_EXPLAIN.transferred, /organization or activity/);
});
test('GBP formatting with separators; null keeps raw', () => {
  assert.equal(fmtAmount(381486, 'GBP'), '£381,486');
  assert.equal(fmtAmount(63323.5, 'GBP'), '£63,323.50');
  assert.equal(fmtAmount(null, 'GBP', '12k'), '12k GBP');
  assert.equal(fmtAmount(null, ''), 'Not reported');
  assert.equal(fmtAmount(1500, ''), '1,500 (currency not reported)');
  assert.equal(fmtAmount(10.125, 'GBP', '10.125'), '£10.125');
  assert.equal(fmtAmount(-250, 'GBP', '-250'), '-£250');
});
test('ISO days do not drift', () => {
  assert.equal(fmtDay('2026-10-30'), '30 Oct 2026');
  assert.equal(fmtDay(null), 'Not reported');
});
test('without DOMParser nothing is guessed', () => {
  const xml = '<transaction ref="Expenditure"><transaction-type code="1"/><value currency="GBP">5</value></transaction>';
  assert.equal(parseXmlSnippet(xml), null);
  assert.equal(decodeFinancial(xml), null);
  assert.equal(parseXmlSnippet('<!DOCTYPE x><a/>'), null);
  assert.equal(parseXmlSnippet('plain text'), null);
});
test('entryDate: budget uses period start', () => {
  assert.equal(entryDate({ kind: 'budget', periodStart: '2025-10-01', transactionDate: null }), '2025-10-01');
  assert.equal(entryDate({ kind: 'spent', periodStart: null, transactionDate: '2026-06-30' }), '2026-06-30');
});
test('headline falls back to first stated generic value, never sums', () => {
  const s = [{ id: 'a', quote: 'q', label: 'Wells', value: '', asOf: null }, { id: 'b', quote: 'q', label: 'Families', value: '412', asOf: null }];
  assert.equal(pickHeadline(s, false)?.stat.id, 'b');
  assert.equal(pickHeadline([], false), null);
});
