"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchEntity = void 0;
const constants_js_1 = require("../constants.js");
async function fetchEntity(guid) {
    console.log(`Fetch Entity ${guid}`);
    return { ...constants_js_1.sampleEntity, guid };
}
exports.fetchEntity = fetchEntity;
//# sourceMappingURL=fetch.js.map