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
