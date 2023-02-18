import chalk from 'chalk';

import { lookUpPerson } from './lookup.js';

export async function run() {
    const guid = 'GUID';
    const person = await lookUpPerson('GUID');

    if (!person) {
        console.log(chalk.red(`Person ${chalk.yellow(guid)} not found.`));
        return;
    }

    console.log(`Found: ${person.name}`);
}
