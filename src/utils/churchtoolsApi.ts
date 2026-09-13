// Publisher-local helpers matching the ChurchTools API query format.
export const GROUP_STATUS_ID = Object.freeze({
    ACTIVE: 1,
    DRAFT: 2,
    ARCHIVED: 3,
    FINISHED: 4,
});

export const getParams = (
    params: Record<string, string | (string | number)[] | number | boolean | null | undefined>,
): string => '?' + Object.entries(params)
    .flatMap(([name, value]) => {
        if (Array.isArray(value)) {
            const arrayName = name.endsWith('[]') ? name : `${name}[]`;
            return value.map((item) => `${arrayName}=${encodeURIComponent(item)}`);
        }
        return value == null ? [] : [`${name}=${encodeURIComponent(value)}`];
    })
    .join('&');
