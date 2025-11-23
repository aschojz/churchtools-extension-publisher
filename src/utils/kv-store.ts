/**
 * This module provides easy to use access to KV storage
 */
import { churchtoolsClient } from '@churchtools/churchtools-client';
import type {
    CustomModule,
    CustomModuleCreate,
    CustomModuleDataCategory,
    CustomModuleDataCategoryCreate,
    CustomModuleDataValue,
    CustomModuleDataValueCreate,
} from './ct-types';

/**
 * ────────────────────────────────────────────────
 *  CUSTOM MODULE itself
 * ────────────────────────────────────────────────
 */
/**
 * retrieves the module configuration
 * @param extensionkey optional - defaults to module with shorty=extensionkey
 * @returns  the custom module
 */
export async function getModule(extensionkey: string = import.meta.env.VITE_KEY): Promise<CustomModule> {
    const allModules: Array<CustomModule> = await churchtoolsClient.get(`/custommodules`);

    const module = allModules.find((item: CustomModule) => item.shorty === extensionkey);

    if (!module) {
        throw new Error(`Module for extension key "${extensionkey}" not found.`);
    }

    console.log(`Module ${extensionkey} found:`, module);

    return module;
}

export async function getOrCreateModule(
    extensionkey: string,
    name: string,
    description: string,
): Promise<CustomModule> {
    try {
        return await getModule(extensionkey);
    } catch {
        return await createModule(extensionkey, name, description);
    }
}

async function createModule(extensionkey: string, name: string, description: string): Promise<CustomModule> {
    const createData: CustomModuleCreate = {
        name: name,
        shorty: extensionkey,
        description: description,
        sortKey: 100,
    };

    return await churchtoolsClient.post<CustomModule>('/custommodules', createData);
}

/**
 * Resolves module id either on provided number or using the getModule function
 * @param moduleId optional if known
 * @returns moduleId
 */
async function resolveModuleId(moduleId?: number): Promise<number> {
    if (moduleId) return moduleId;
    const module = await getModule();
    return module.id;
}

/**
 * ────────────────────────────────────────────────
 *  CUSTOM DATA CATEGORIES
 * ────────────────────────────────────────────────
 */

/**
 * retrieves a list of all custom data categories
 * T is used to cast JSON data into readable object
 * @param moduleId - optional module id - otherwise tries default
 * @returns list of category objects and repective data following T
 * implements GET `/custommodules/{moduleId}/customdatacategories`
 */
export async function getCustomDataCategories<T extends object>(
    moduleId?: number,
): Promise<(T & Omit<CustomModuleDataCategory, 'data'>)[]> {
    moduleId = await resolveModuleId(moduleId);

    const categories: CustomModuleDataCategory[] = await churchtoolsClient.get(
        `/custommodules/${moduleId}/customdatacategories`,
    );

    return categories.map(category => {
        const { data, ...rest } = category;
        const parsedData = safeParseJSON(data, {} as T);
        return { ...rest, ...parsedData };
    });
}

/**
 * retrieve a single category
 * @param shorty short name of the extension - preferably matching extension name
 * @returns the one category with matching name - if it exists
 */
export async function getCustomDataCategory<T extends object>(
    shorty: string,
): Promise<CustomModuleDataCategory | undefined> {
    const categories = await getCustomDataCategories<T>();
    return categories.find(category => category.shorty === shorty);
}

/**
 * Create a new custom data category
 * Implements: POST `/custommodules/{moduleId}/customdatacategories`
 * @param payload new data to be saved
 * @param moduleId - optional module id - otherwise tries default
 * @returns - the created category
 */
export async function createCustomDataCategory(
    payload: CustomModuleDataCategoryCreate,
    moduleId?: number,
): Promise<CustomModuleDataCategory> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.post<CustomModuleDataCategory>(`/custommodules/${moduleId}/customdatacategories`, payload);
}

/**
 * update an existing custom data category
 * implements  PUT `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}`
 * @param moduleId - optional module id - otherwise tries default
 */
export async function updateCustomDataCategory(
    dataCategoryId: number,
    payload: Partial<CustomModuleDataCategory>,
    moduleId?: number,
): Promise<void> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.put(`/custommodules/${moduleId}/customdatacategories/${dataCategoryId}`, payload);
}

/**
 * Delete an existing custom data category
 * implements DELETE `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}`
 * @param moduleId - optional module id - otherwise tries default
 */
export async function deleteCustomDataCategory(dataCategoryId: number, moduleId?: number): Promise<void> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.deleteApi(`/custommodules/${moduleId}/customdatacategories/${dataCategoryId}`);
}

/**
 * ────────────────────────────────────────────────
 *  CUSTOM DATA VALUES
 * ────────────────────────────────────────────────
 */

/** Get existing custom data value and cast it's JSON content into readable format of type T
 * implements GET `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}/customdatavalues`
 * @param moduleId - optional module id - otherwise tries default
 * @returns - the custom data value casted as T and metadata
 */
export async function getCustomDataValues<T extends object>(
    dataCategoryId: number,
    moduleId?: number,
): Promise<(T & Omit<CustomModuleDataValue, 'value'>)[]> {
    moduleId = await resolveModuleId(moduleId);

    const values: (Omit<CustomModuleDataValue, 'value'> & { value: string })[] = await churchtoolsClient.get(
        `/custommodules/${moduleId}/customdatacategories/${dataCategoryId}/customdatavalues`,
    );

    return values.map(val => {
        const { value, ...rest } = val;

        if (value == null) {
            throw new Error(`Custom data value ${val.id} has null or undefined 'value' field.`);
        }

        const parsedData = safeParseJSON(value, {} as T);
        return { ...rest, ...parsedData };
    });
}

/**
 * Create a new custom data value
 * implements POST `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}/customdatavalues`
 * @param moduleId - optional module id - otherwise tries default
 */
export async function createCustomDataValue(payload: CustomModuleDataValueCreate, moduleId?: number): Promise<void> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.post(
        `/custommodules/${moduleId}/customdatacategories/${payload.dataCategoryId}/customdatavalues`,
        payload,
    );
}

/**
 * update an existing custom data value.
 * implements PUT `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}/customdatavalues/{valueId}`
 * @param moduleId - optional module id - otherwise tries default
 */
export async function updateCustomDataValue(
    dataCategoryId: number,
    valueId: number,
    payload: Partial<CustomModuleDataValue>,
    moduleId?: number,
): Promise<void> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.put(
        `/custommodules/${moduleId}/customdatacategories/${dataCategoryId}/customdatavalues/${valueId}`,
        payload,
    );
}

/**
 * delete an existing custom data value
 * implements DELETE `/custommodules/{moduleId}/customdatacategories/{dataCategoryId}/customdatavalues/{valueId}`
 * @param moduleId - optional module id - otherwise tries default
 */
export async function deleteCustomDataValue(dataCategoryId: number, valueId: number, moduleId?: number): Promise<void> {
    moduleId = await resolveModuleId(moduleId);
    return churchtoolsClient.deleteApi(
        `/custommodules/${moduleId}/customdatacategories/${dataCategoryId}/customdatavalues/${valueId}`,
    );
}

/**
 * ────────────────────────────────────────────────
 *  Other Utils
 * ────────────────────────────────────────────────
 */

function safeParseJSON<T>(json: string | null | undefined, fallback: T): T {
    if (!json) return fallback;
    try {
        return JSON.parse(json) as T;
    } catch (err) {
        console.warn('Failed to parse JSON:', err);
        return fallback;
    }
}
