import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { appointmentUpdateSchema } from '../src/schema/appointment';

describe('appointmentUpdateSchema', () => {
  it('retains null assistantId values to allow disconnection', () => {
    const payload = appointmentUpdateSchema.parse({ assistantId: null });

    assert.ok(Object.prototype.hasOwnProperty.call(payload, 'assistantId'));
    assert.equal(payload.assistantId, null);
  });
});
