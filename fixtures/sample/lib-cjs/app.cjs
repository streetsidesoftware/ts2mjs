"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = void 0;
const chalk_1 = __importDefault(require("chalk"));
const lookup_js_1 = require("./lookup.cjs");
async function run() {
    const guid = 'GUID';
    const person = await (0, lookup_js_1.lookUpPerson)('GUID');
    if (!person) {
        console.log(chalk_1.default.red(`Person ${chalk_1.default.yellow(guid)} not found.`));
        return;
    }
    console.log(`Found: ${person.name}`);
}
exports.run = run;
//# sourceMappingURL=app.cjs.map