import { sampleEntity } from '../constants.js';
import type { Entity, GUID } from '../types.js';

export async function fetchEntity(guid: GUID): Promise<Entity | undefined> {
    console.log(`Fetch Entity ${guid}`);
    return { ...sampleEntity, guid };
}
