import { Entity, GUID } from '../types.js';

export async function fetchEntity<T extends Entity>(guid: GUID): Promise<T | undefined> {
    console.log(`Fetch Entity ${guid}`);
    return undefined;
}
