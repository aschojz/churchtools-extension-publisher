export const THEME_STORAGE_KEY = 'churchtools-publisher-theme';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type ThemePreference = typeof THEME_PREFERENCES[number];
export type ResolvedTheme = Exclude<ThemePreference, 'system'>;

export const isThemePreference = (value: string | null): value is ThemePreference =>
    THEME_PREFERENCES.some((preference) => preference === value);

export const loadThemePreference = (
    storage: Pick<Storage, 'getItem'>,
    fallback: ThemePreference = 'system',
): ThemePreference => {
    try {
        const storedPreference = storage.getItem(THEME_STORAGE_KEY);
        return isThemePreference(storedPreference) ? storedPreference : fallback;
    } catch {
        return fallback;
    }
};

export const saveThemePreference = (
    storage: Pick<Storage, 'setItem'>,
    preference: ThemePreference,
) => {
    try {
        storage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
        // A blocked or full storage must not prevent theme switching for this session.
    }
};

export const resolveTheme = (
    preference: ThemePreference,
    systemPrefersDark: boolean,
): ResolvedTheme => preference === 'system'
    ? (systemPrefersDark ? 'dark' : 'light')
    : preference;
