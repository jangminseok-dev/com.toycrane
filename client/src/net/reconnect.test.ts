import { expect, test } from 'vitest';
import { nextDelay } from './reconnect';

test('backoff', () => expect([0, 1, 2, 3, 4, 10].map(nextDelay)).toEqual([500, 1000, 2000, 4000, 8000, 8000]));
