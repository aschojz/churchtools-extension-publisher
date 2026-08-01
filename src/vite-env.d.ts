/// <reference types="vite/client" />

declare global {
    interface Window {
        settings?: {
            base_url?: string;
            language?: string;
            timezone?: string;
        };
    }
}

export {};
