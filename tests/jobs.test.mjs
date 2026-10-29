import test from 'node:test'
import assert from 'node:assert/strict'
import { initialJobStatus } from '../server/jobs.mjs'

test('review setting holds immediate and scheduled jobs for approval', () => {
  assert.equal(initialJobStatus({ requireReview: true }, { publishNow: true }), 'review')
  assert.equal(initialJobStatus({ requireReview: true }, { publishNow: false }), 'review')
})

test('jobs enter the correct queue when review is disabled', () => {
  assert.equal(initialJobStatus({ requireReview: false }, { publishNow: true }), 'queued')
  assert.equal(initialJobStatus({ requireReview: false }, { publishNow: false }), 'scheduled')
})
