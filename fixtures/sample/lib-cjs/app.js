"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lookup_js_1 = require("./lookup.js");
async function run() {
    const guid = 'GUID';
    const person = await (0, lookup_js_1.lookUpPerson)('GUID');
    if (!person) {
        console.log(`Person "${guid}" not found.`);
        return;
    }
    console.log(`Found: ${person.name}`);
}
run();
//# sourceMappingURL=app.js.map