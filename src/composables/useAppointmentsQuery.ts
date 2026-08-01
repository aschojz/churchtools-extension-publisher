import type { GetCalendarsAppointmentsResponse } from '@churchtools/api-types';
import { churchtoolsClient } from '@churchtools/churchtools-client';
import { getParams } from '@churchtools/utils';
import { useQuery } from '@tanstack/vue-query';
import type { MaybeRefOrGetter } from 'vue';
import { toValue } from 'vue';

const toDateString = (date: Date) => date.toISOString().slice(0, 10);

const today = new Date();
const rangeStart = toDateString(today);
const rangeEndDate = new Date(today);
rangeEndDate.setFullYear(rangeEndDate.getFullYear() + 1);
const rangeEnd = toDateString(rangeEndDate);

export const useAppointmentsQuery = (calendarIds: MaybeRefOrGetter<number[]>) =>
    useQuery({
        queryKey: ['calendars', 'appointments', 'selection', calendarIds, rangeStart, rangeEnd],
        queryFn: async () => {
            const ids = toValue(calendarIds);
            return await churchtoolsClient.get<GetCalendarsAppointmentsResponse['data']>(
                `/calendars/appointments${getParams({
                    'calendar_ids[]': ids,
                    from: rangeStart,
                    to: rangeEnd,
                })}`,
            );
        },
        enabled: () => toValue(calendarIds).length > 0,
    });
