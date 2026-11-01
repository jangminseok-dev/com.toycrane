import { expect, test } from 'vitest';
import { zoneAt } from './layout';

test.each([
  [0, 0, 'plaza'], [-16, 0, 'doll'], [16, 0, 'figure'], [0, -18, 'north'], [-17, 18, 'rest'], [0, 15, 'path'],
])('zoneAt(%d,%d) = %s', (x, z, zone) => expect(zoneAt(x, z)).toBe(zone));
