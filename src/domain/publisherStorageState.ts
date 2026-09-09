import {
    PublisherRepositoryError,
    type PublisherRepositoryErrorCode,
} from './publisherRepository';

export type PublisherStorageStatus =
    | 'conflict'
    | 'dirty'
    | 'error'
    | 'loading'
    | 'local'
    | 'offline'
    | 'permission'
    | 'saved'
    | 'saving';

export interface PublisherStorageFailure {
    code: PublisherRepositoryErrorCode;
    message: string;
    status: PublisherStorageStatus;
    showAsError: boolean;
}

export const publisherStorageFailure = (error: unknown, fallback: string): PublisherStorageFailure => {
    const code: PublisherRepositoryErrorCode = error instanceof PublisherRepositoryError
        ? error.code
        : 'unavailable';
    const sourceMessage = error instanceof Error ? error.message : fallback;
    if (code === 'unavailable') {
        return {
            code,
            status: 'local',
            message: `${sourceMessage} Änderungen werden lokal zur Wiederherstellung gesichert.`,
            showAsError: false,
        };
    }
    if (code === 'offline') {
        return {
            code,
            status: 'offline',
            message: 'ChurchTools ist offline. Änderungen werden lokal zur Wiederherstellung gesichert.',
            showAsError: false,
        };
    }
    return {
        code,
        status: code === 'invalid' ? 'error' : code,
        message: sourceMessage,
        showAsError: true,
    };
};

export const publisherStorageSupportsAutosave = (status: PublisherStorageStatus) =>
    !['conflict', 'error', 'local', 'offline', 'permission'].includes(status);
