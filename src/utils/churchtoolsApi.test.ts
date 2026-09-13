import { describe, expect, it } from 'vitest';
import { getParams, GROUP_STATUS_ID } from './churchtoolsApi';

describe('ChurchTools query parameters', () => {
    it('serializes array filters using one bracket pair and preserves value order', () => {
        expect(getParams({ 'calendar_ids[]': [2, 7], include: ['memberStatistics', 'places'] }))
            .toBe('?calendar_ids[]=2&calendar_ids[]=7&include[]=memberStatistics&include[]=places');
    });

    it('encodes text values and retains false, zero and empty strings', () => {
        expect(getParams({ search: 'Gäste & Freunde/+', limit: 0, active: false, name: '' }))
            .toBe('?search=G%C3%A4ste%20%26%20Freunde%2F%2B&limit=0&active=false&name=');
    });

    it('omits missing values and empty arrays', () => {
        expect(getParams({ missing: undefined, empty: null, ids: [], limit: 1 })).toBe('?limit=1');
        expect(getParams({})).toBe('?');
    });

    it('includes all group statuses when loading a linked signup group', () => {
        expect(getParams({ group_status_ids: Object.values(GROUP_STATUS_ID) }))
            .toBe('?group_status_ids[]=1&group_status_ids[]=2&group_status_ids[]=3&group_status_ids[]=4');
    });
});
