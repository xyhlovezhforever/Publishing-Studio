import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { JsonStore } from '../server/store.mjs'

test('JSON store initializes and persists an update', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'publishing-studio-'))
  const store = new JsonStore(path.join(directory, 'store.json'))
  await store.init()
  const initial = await store.read()
  assert.equal(initial.settings.mode, 'simulation')
  await store.update((state) => {
    state.settings.requireReview = false
    return state
  })
  const updated = await store.read()
  assert.equal(updated.settings.requireReview, false)
  await rm(directory, { recursive: true, force: true })
})
