export type PublisherDataFormatType = 'date' | 'time' | 'url' | 'list' | 'number';

export interface PublisherDataValue {
    value: string;
    formatType?: PublisherDataFormatType;
    rawValue?: string;
    locale?: string;
    timeZone?: string;
    values?: string[];
}

export type PublisherDataValues = Record<string, string | PublisherDataValue>;

export const PUBLISHER_VARIABLE_EXPRESSION_VERSION = 1;

export interface PublisherVariableTransform {
    name: string;
    arguments: string[];
}

export interface PublisherVariableExpression {
    fieldId: string;
    version: 0 | typeof PUBLISHER_VARIABLE_EXPRESSION_VERSION;
    transforms: PublisherVariableTransform[];
}

const MAX_TRANSFORMS = 8;
const MAX_ARGUMENTS = 5;
const MAX_ARGUMENT_LENGTH = 256;
const FIELD_ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const TRANSFORM_NAME_PATTERN = /^[a-z][a-z-]{0,31}$/;

const splitUnquoted = (value: string, separator: string) => {
    const parts: string[] = [];
    let current = '';
    let quote = '';
    let escaped = false;
    for (const character of value) {
        if (escaped) {
            current += character;
            escaped = false;
        } else if (character === '\\' && quote) {
            current += character;
            escaped = true;
        } else if (quote) {
            current += character;
            if (character === quote) quote = '';
        } else if (character === "'" || character === '"') {
            current += character;
            quote = character;
        } else if (character === separator) {
            parts.push(current.trim());
            current = '';
        } else {
            current += character;
        }
    }
    parts.push(current.trim());
    return quote ? null : parts;
};

const firstUnquotedColon = (value: string) => {
    let quote = '';
    let escaped = false;
    for (let index = 0; index < value.length; index += 1) {
        const character = value[index]!;
        if (escaped) escaped = false;
        else if (character === '\\' && quote) escaped = true;
        else if (quote) {
            if (character === quote) quote = '';
        } else if (character === "'" || character === '"') quote = character;
        else if (character === ':') return index;
    }
    return -1;
};

const unquoteArgument = (argument: string) => {
    const trimmed = argument.trim();
    const quote = trimmed[0];
    if ((quote === "'" || quote === '"') && trimmed.at(-1) === quote) {
        return trimmed.slice(1, -1).replace(/\\(['"\\])/g, '$1');
    }
    return trimmed;
};

const parseTransform = (source: string): PublisherVariableTransform | null => {
    const colon = firstUnquotedColon(source);
    const name = (colon < 0 ? source : source.slice(0, colon)).trim().toLowerCase();
    if (!TRANSFORM_NAME_PATTERN.test(name)) return null;
    if (colon < 0) return { name, arguments: [] };
    const argumentsSource = source.slice(colon + 1);
    const argumentParts = splitUnquoted(argumentsSource, ',');
    if (!argumentParts || argumentParts.length > MAX_ARGUMENTS) return null;
    const args = argumentParts.map(unquoteArgument);
    if (args.some((argument) => argument.length > MAX_ARGUMENT_LENGTH)) return null;
    return { name, arguments: args };
};

export const parsePublisherVariableExpression = (source: string): PublisherVariableExpression | null => {
    const match = /^\{\{\s*([a-zA-Z][a-zA-Z0-9_-]{0,63})(.*?)\s*\}\}$/.exec(source);
    if (!match || !FIELD_ID_PATTERN.test(match[1]!)) return null;
    const pipeline = match[2]!.trim();
    if (!pipeline) return { fieldId: match[1]!, version: 0, transforms: [] };
    if (!pipeline.startsWith('|')) return null;
    const parts = splitUnquoted(pipeline.slice(1), '|');
    if (!parts || parts.some((part) => !part)) return null;
    let version: PublisherVariableExpression['version'] = 0;
    if (/^v\d+$/.test(parts[0]!)) {
        if (parts[0] !== `v${PUBLISHER_VARIABLE_EXPRESSION_VERSION}`) return null;
        version = PUBLISHER_VARIABLE_EXPRESSION_VERSION;
        parts.shift();
    }
    if (parts.length > MAX_TRANSFORMS) return null;
    const transforms = parts.map(parseTransform);
    if (transforms.some((transform) => !transform)) return null;
    return { fieldId: match[1]!, version, transforms: transforms as PublisherVariableTransform[] };
};

export const quotePublisherVariableArgument = (value: string) =>
    `'${value.slice(0, MAX_ARGUMENT_LENGTH).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

export const createPublisherVariableExpression = (
    fieldId: string,
    transforms: PublisherVariableTransform[] = [],
) => {
    if (!FIELD_ID_PATTERN.test(fieldId)) throw new Error('Ungültige Publisher-Variable.');
    const pipeline = transforms.slice(0, MAX_TRANSFORMS).map(({ name, arguments: args }) => {
        if (!TRANSFORM_NAME_PATTERN.test(name) || args.length > MAX_ARGUMENTS) {
            throw new Error('Ungültige Publisher-Transformation.');
        }
        return `${name}${args.length ? `:${args.map(quotePublisherVariableArgument).join(',')}` : ''}`;
    });
    return `{{${fieldId}|v${PUBLISHER_VARIABLE_EXPRESSION_VERSION}${pipeline.length ? `|${pipeline.join('|')}` : ''}}}`;
};

const dateParts = (data: PublisherDataValue) => {
    const date = new Date(data.rawValue ?? data.value);
    if (Number.isNaN(date.getTime())) return null;
    const formatter = (options: Intl.DateTimeFormatOptions) => {
        try {
            return new Intl.DateTimeFormat(data.locale ?? 'de-DE', { ...options, timeZone: data.timeZone }).formatToParts(date);
        } catch {
            return new Intl.DateTimeFormat(data.locale ?? 'de-DE', options).formatToParts(date);
        }
    };
    const parts = formatter({ day: '2-digit', month: '2-digit', year: 'numeric' });
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    const shortMonth = formatter({ month: 'short' }).find((part) => part.type === 'month')?.value.replace(/\.$/, '') ?? '';
    return { day: get('day'), month: get('month'), year: get('year'), shortMonth };
};

const timeParts = (data: PublisherDataValue) => {
    const date = new Date(data.rawValue ?? data.value);
    if (Number.isNaN(date.getTime())) return null;
    let parts: Intl.DateTimeFormatPart[];
    try {
        parts = new Intl.DateTimeFormat(data.locale ?? 'de-DE', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: data.timeZone,
        }).formatToParts(date);
    } catch {
        parts = new Intl.DateTimeFormat(data.locale ?? 'de-DE', {
            hour: '2-digit', minute: '2-digit', hour12: false,
        }).formatToParts(date);
    }
    const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    return { hour: get('hour').padStart(2, '0'), minute: get('minute').padStart(2, '0') };
};

const parseNumber = (source: string) => {
    const compact = source.trim().replace(/[\s\u00a0]/g, '');
    if (!compact) return null;
    const comma = compact.lastIndexOf(',');
    const dot = compact.lastIndexOf('.');
    const decimalSeparator = comma > dot ? ',' : dot > comma ? '.' : '';
    const normalized = decimalSeparator
        ? `${compact.slice(0, Math.max(comma, dot)).replace(/[.,]/g, '')}.${compact.slice(Math.max(comma, dot) + 1)}`
        : compact;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
};

const numberFormat = (data: PublisherDataValue, currentValue: string, args: string[]) => {
    const value = parseNumber(data.rawValue ?? currentValue);
    if (value === null) return currentValue;
    const style = args[0] ?? 'decimal';
    const numericArgument = (index: number, fallback: number) => {
        const candidate = Number(args[index]);
        return Number.isInteger(candidate) ? Math.min(6, Math.max(0, candidate)) : fallback;
    };
    const options: Intl.NumberFormatOptions = style === 'integer'
        ? { maximumFractionDigits: 0 }
        : style === 'percent'
            ? { style: 'percent', minimumFractionDigits: numericArgument(1, 0), maximumFractionDigits: numericArgument(2, 2) }
            : style === 'currency'
                ? { style: 'currency', currency: /^[A-Z]{3}$/.test(args[1] ?? '') ? args[1] : 'EUR', minimumFractionDigits: numericArgument(2, 2), maximumFractionDigits: numericArgument(3, 2) }
                : { minimumFractionDigits: numericArgument(1, 0), maximumFractionDigits: numericArgument(2, 2) };
    try {
        return new Intl.NumberFormat(data.locale ?? 'de-DE', options).format(value);
    } catch {
        return currentValue;
    }
};

export const formatPublisherDataValue = (
    data: PublisherDataValue,
    formatter: string,
    pattern: string,
) => {
    if (formatter === 'date' && data.formatType === 'date') {
        const parts = dateParts(data);
        if (!parts) return data.value;
        const day = String(Number(parts.day));
        return ({
            'DD.MM.': `${parts.day}.${parts.month}.`,
            'D. MMM': `${day}. ${parts.shortMonth}`,
            'DD.MM.YY': `${parts.day}.${parts.month}.${parts.year.slice(-2)}`,
            'DD.MM.YYYY': `${parts.day}.${parts.month}.${parts.year}`,
        } as Record<string, string>)[pattern] ?? data.value;
    }
    if (formatter === 'time' && data.formatType === 'time') {
        const parts = timeParts(data);
        if (!parts) return data.value;
        const hour = String(Number(parts.hour));
        return ({
            'HH:mm': `${parts.hour}:${parts.minute}`,
            'HH.mm': `${parts.hour}.${parts.minute}`,
            'H:mm': `${hour}:${parts.minute}`,
            'H Uhr': `${hour} Uhr`,
        } as Record<string, string>)[pattern] ?? data.value;
    }
    if (formatter === 'list' && data.formatType === 'list' && data.values) {
        const values = data.values.map((value) => value.trim()).filter(Boolean);
        if (pattern === 'lines') return values.join('\n');
        if (pattern === 'bullets') return values.map((value) => `• ${value}`).join('\n');
        if (pattern === 'first') return values[0] ?? '';
        if (pattern === 'and') {
            try {
                return new Intl.ListFormat(data.locale ?? 'de-DE', { style: 'long', type: 'conjunction' }).format(values);
            } catch {
                return values.join(', ');
            }
        }
        if (pattern === 'comma') return values.join(', ');
    }
    if (formatter === 'number' && data.formatType === 'number') return numberFormat(data, data.value, [pattern]);
    return data.value;
};

const applyCondition = (currentValue: string, args: string[]) => {
    const operator = args[0] ?? '';
    const normalized = currentValue.trim();
    const simple = operator === 'empty' || operator === 'not-empty';
    const operand = simple ? '' : args[1] ?? '';
    const thenValue = simple ? args[1] : args[2];
    const elseValue = simple ? args[2] : args[3];
    const matches = operator === 'empty' ? normalized === ''
        : operator === 'not-empty' ? normalized !== ''
            : operator === 'equals' ? currentValue === operand
                : operator === 'not-equals' ? currentValue !== operand
                    : operator === 'contains' ? currentValue.includes(operand)
                        : false;
    return matches ? thenValue ?? currentValue : elseValue ?? currentValue;
};

const applyTransform = (data: PublisherDataValue, currentValue: string, transform: PublisherVariableTransform) => {
    const [first = ''] = transform.arguments;
    if (transform.name === 'default') return currentValue.trim() ? currentValue : first;
    if (transform.name === 'if') return applyCondition(currentValue, transform.arguments);
    if (transform.name === 'trim') return currentValue.trim();
    if (transform.name === 'upper') return currentValue.toLocaleUpperCase(data.locale);
    if (transform.name === 'lower') return currentValue.toLocaleLowerCase(data.locale);
    if (transform.name === 'number') return numberFormat(data, currentValue, transform.arguments);
    if (transform.name === 'date' || transform.name === 'time' || transform.name === 'list') {
        return formatPublisherDataValue({ ...data, value: currentValue }, transform.name, first);
    }
    return currentValue;
};

const PLACEHOLDER_PATTERN = /\{\{\s*[a-zA-Z][a-zA-Z0-9_-]{0,63}(?:[^{}]*)\}\}/g;

export const resolvePublisherPlaceholders = (value: string, dataValues: PublisherDataValues) =>
    value.replace(PLACEHOLDER_PATTERN, (placeholder) => {
        const expression = parsePublisherVariableExpression(placeholder);
        if (!expression) return placeholder;
        const candidate = dataValues[expression.fieldId];
        if (candidate === undefined && !expression.transforms.some(({ name }) => name === 'default' || name === 'if')) {
            return placeholder;
        }
        const data: PublisherDataValue = typeof candidate === 'string'
            ? { value: candidate }
            : candidate ?? { value: '' };
        return expression.transforms.reduce(
            (current, transform) => applyTransform(data, current, transform),
            data.value,
        );
    });
