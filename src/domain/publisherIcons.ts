import {
    faBookBible,
    faCalendarDays,
    faChurch,
    faClock,
    faCross,
    faDove,
    faHandsPraying,
    faHeart,
    faLocationDot,
    faMicrophone,
    faMusic,
    faStar,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

export const PUBLISHER_ICONS = [
    { id: 'church', label: 'Kirche', icon: faChurch },
    { id: 'cross', label: 'Kreuz', icon: faCross },
    { id: 'calendar', label: 'Kalender', icon: faCalendarDays },
    { id: 'clock', label: 'Uhr', icon: faClock },
    { id: 'location', label: 'Ort', icon: faLocationDot },
    { id: 'heart', label: 'Herz', icon: faHeart },
    { id: 'star', label: 'Stern', icon: faStar },
    { id: 'music', label: 'Musik', icon: faMusic },
    { id: 'praying-hands', label: 'Gebet', icon: faHandsPraying },
    { id: 'dove', label: 'Taube', icon: faDove },
    { id: 'bible', label: 'Bibel', icon: faBookBible },
    { id: 'microphone', label: 'Mikrofon', icon: faMicrophone },
] as const satisfies readonly { id: string; label: string; icon: IconDefinition }[];

export type PublisherIconName = (typeof PUBLISHER_ICONS)[number]['id'];

export const isPublisherIconName = (value: unknown): value is PublisherIconName =>
    typeof value === 'string' && PUBLISHER_ICONS.some(({ id }) => id === value);

export const publisherIcon = (name: PublisherIconName) =>
    PUBLISHER_ICONS.find(({ id }) => id === name)!;
