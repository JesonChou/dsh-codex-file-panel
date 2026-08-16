import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply, name } from '../lib/index.js'

test('exports the bundle plugin face', () => {
  assert.equal(name, 'hello-plugin')
  assert.equal(typeof apply, 'function')
})

test('apply registers a reversible effect without throwing', () => {
  const disposers = []
  const ctx = {
    effect(callback, label) {
      assert.equal(label, 'hello-plugin: greeting')
      const disposer = callback()
      disposers.push(disposer)
      return disposer
    },
  }

  assert.doesNotThrow(() => apply(ctx))
  assert.equal(disposers.length, 1)
  assert.doesNotThrow(() => disposers[0]())
})
