import { describe, expect, it } from 'vitest';
import { getProfile } from './euSteelProfiles';
import { mprlToProfileId } from './mprlNameMapper';

describe('mprlToProfileId', () => {
  it.each([
    ['UniversalColumn BS EN10210-2 1990 UC305x305x97', 'UC305x305x97'],
    ['UniversalBeam BS 4-1:2005 UB305x165x40', 'UB305x165x40'],
    ['Channel BS 4-1 PFC300x100x46', 'PFC300x100x46'],
    ['UC305x305x97', 'UC305x305x97'], // bare designation
    ['uc305X305X97', 'UC305x305x97'], // normalization
  ])('extracts and normalizes %s', (mprl, expected) => {
    expect(mprlToProfileId(mprl)).toBe(expected);
  });

  it.each([[null], [''], ['   ']])('maps blank name %# to null', (mprl) => {
    expect(mprlToProfileId(mprl)).toBeNull();
  });

  it('mapped ids resolve in the UK catalog', () => {
    const id = mprlToProfileId('UniversalColumn BS EN10210-2 1990 UC305x305x97');
    expect(getProfile(id!)).toBeDefined();
    expect(getProfile(mprlToProfileId('Channel BS 4-1 PFC300x100x46')!)).toBeDefined();
  });
});
