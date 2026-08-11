import { describe, expect, it, vi } from 'vitest';

import {
    loadThemePreference,
    resolveTheme,
    saveThemePreference,
    THEME_STORAGE_KEY,
} from './theme';

describe('publisher theme', () => {
    it('loads only supported preferences and otherwise follows the system', () => {
        expect(loadThemePreference({ getItem: () => 'dark' })).toBe('dark');
        expect(loadThemePreference({ getItem: () => 'sepia' })).toBe('system');
        expect(loadThemePreference({ getItem: () => null })).toBe('system');
        expect(loadThemePreference({ getItem: () => { throw new Error('blocked'); } })).toBe('system');
    });

    it('resolves the system preference without changing explicit choices', () => {
        expect(resolveTheme('system', true)).toBe('dark');
        expect(resolveTheme('system', false)).toBe('light');
        expect(resolveTheme('light', true)).toBe('light');
        expect(resolveTheme('dark', false)).toBe('dark');
    });

    it('stores a preference without surfacing storage errors', () => {
        const setItem = vi.fn();
        saveThemePreference({ setItem }, 'light');
        expect(setItem).toHaveBeenCalledWith(THEME_STORAGE_KEY, 'light');
        expect(() => saveThemePreference({ setItem: () => { throw new Error('full'); } }, 'dark'))
            .not.toThrow();
    });
});
