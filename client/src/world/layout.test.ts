import { expect, test } from 'vitest';
import { zoneAt } from './layout';

test.each([
  [0, 0, 'hub'], [0, -10, 'big'], [-10, 0, 'mini'], [10, 0, 'figure'],
  [-3, 10, 'mini'], [3, 10, 'figure'], [0, 10, 'path'], [-5.2, 0, 'path'],
])('zoneAt(%d,%d) = %s', (x, z, zone) => expect(zoneAt(x, z)).toBe(zone));
