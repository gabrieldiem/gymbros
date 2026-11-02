import { describe, expect, it } from 'vitest';

import { inkOn, memberColorHex } from '../src/components/memberColor';

describe('member colors', () => {
  it('turns a palette name into its color and leaves any other as it is', () => {
    expect(memberColorHex('cyan')).toBe('#00D1FF');
    expect(memberColorHex('#123456')).toBe('#123456');
  });

  it('picks the text that reads on the color', () => {
    expect(inkOn('volt')).toBe('#0D0D0D');
    expect(inkOn('#f2f2ee')).toBe('#0D0D0D');
    expect(inkOn('#101040')).toBe('#F2F2EE');
    expect(inkOn('#000000')).toBe('#F2F2EE');
  });
});
