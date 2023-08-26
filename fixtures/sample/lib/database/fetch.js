import { sampleEntity } from '../constants.js';
export async function fetchEntity(guid) {
    console.log(`Fetch Entity ${guid}`);
    return { ...sampleEntity, guid };
}
//# sourceMappingURL=fetch.js.map