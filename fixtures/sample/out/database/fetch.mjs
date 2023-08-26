import { sampleEntity } from '../constants.mjs';
export async function fetchEntity(guid) {
    console.log(`Fetch Entity ${guid}`);
    return { ...sampleEntity, guid };
}
//# sourceMappingURL=fetch.mjs.map