#! /usr/bin/env node

const util = require('util');
const exec = util.promisify(require('child_process').exec);
const commandExistsSync = require('command-exists').sync;

async function isFuncVm() {
    let stdout;

    try {
        const { stdout } = await exec(`func --is-funcvm`);
        return stdout.trim() === 'yes';
    } catch {
        return false;
    }
}

async function validateEnvironment() {
    try {
        console.log('Validating environment...\n');
        
        const funcExists = commandExistsSync('ls');
        
        if (!funcExists) {
            // we're good
            process.exit(0);
        }
        const funcvmInstalled = await isFuncVm();
        if (!funcvmInstalled) {
            console.warn(`Azure Functions Core Tools appears to be installed already. It's highly recommended that you uninstall it before installing funcvm.`);
        }
    } catch (err) {
        console.log(err);
    }
}

validateEnvironment();
