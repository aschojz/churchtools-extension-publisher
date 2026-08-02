export interface SearchableAppointment {
    title: string;
    calendarId: string;
    calendarName: string;
}

const normalizeSearchText = (value: string) =>
    value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase()
        .trim();

export const matchesAppointmentFilters = (
    appointment: SearchableAppointment,
    query: string,
    calendarId: string,
) => {
    if (calendarId && appointment.calendarId !== calendarId) {
        return false;
    }

    const searchTerms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
    if (searchTerms.length === 0) {
        return true;
    }

    const haystack = normalizeSearchText(`${appointment.title} ${appointment.calendarName}`);
    return searchTerms.every((term) => haystack.includes(term));
};

export const isAppointmentWithinDays = (
    startDate: string,
    days: number | null,
    referenceDate: Date,
) => {
    const startTime = new Date(startDate).getTime();
    const referenceTime = referenceDate.getTime();
    if (!Number.isFinite(startTime) || !Number.isFinite(referenceTime) || (days !== null && days < 0)) {
        return false;
    }

    const referenceDayStart = new Date(referenceDate);
    referenceDayStart.setHours(0, 0, 0, 0);
    if (startTime < referenceDayStart.getTime()) {
        return false;
    }

    return days === null || startTime <= referenceTime + days * 24 * 60 * 60 * 1000;
};
