import { lookUpPerson } from './lookup.mjs';
async function run() {
    const guid = 'GUID';
    const person = await lookUpPerson('GUID');
    if (!person) {
        console.log(`Person "${guid}" not found.`);
        return;
    }
    console.log(`Found: ${person.name}`);
}
run();
//# sourceMappingURL=app.mjs.map