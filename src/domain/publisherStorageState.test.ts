import { describe, expect, it } from 'vitest';

import { PublisherRepositoryError } from './publisherRepository';
import {
    publisherStorageFailure,
    publisherStorageSupportsAutosave,
} from './publisherStorageState';

describe('publisher storage state', () => {
    it('treats an unavailable CCM module as local recovery instead of a hard error', () => {
        const failure = publisherStorageFailure(
            new PublisherRepositoryError('unavailable', 'Das Custom Module wurde nicht gefunden.'),
            'Speichern fehlgeschlagen.',
        );

        expect(failure).toMatchObject({ status: 'local', showAsError: false });
        expect(failure.message).toContain('lokal zur Wiederherstellung gesichert');
        expect(publisherStorageSupportsAutosave(failure.status)).toBe(false);
    });

    it('keeps actionable repository errors visible and pauses automatic retries', () => {
        for (const code of ['conflict', 'invalid', 'permission'] as const) {
            const failure = publisherStorageFailure(
                new PublisherRepositoryError(code, `Fehler ${code}`),
                'Speichern fehlgeschlagen.',
            );
            expect(failure.showAsError).toBe(true);
            expect(publisherStorageSupportsAutosave(failure.status)).toBe(false);
        }
    });

    it('allows autosave while loading, dirty, saving or saved', () => {
        expect((['loading', 'dirty', 'saving', 'saved'] as const).every(publisherStorageSupportsAutosave)).toBe(true);
    });
});
