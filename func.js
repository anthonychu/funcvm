#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getLocations, constants } = require('./common');
const args = process.argv;

const version = '4.0.3928';

async function main() {

    if (args.length >= 3 && args[2] === '--is-funcvm') {
        console.log('yes');
        return;
    }

    const { downloadDir } = await getLocations();

    const versionFile = path.join(downloadDir, 'funcvm-core-tools-version.txt');
    const localVersionFile = path.join(process.cwd(), '.func-version');
    let version;

    if (!!process.env[constants.versionEnvironmentVariableName]) {
        version = process.env[constants.versionEnvironmentVariableName];
    } else if (fs.existsSync(localVersionFile)) {
        version = fs.readFileSync(localVersionFile, 'utf8').trim();
    } else if (fs.existsSync(versionFile)) {
        version = fs.readFileSync(versionFile, 'utf8');
    } else {
        console.error('funcvm not initialized. Run funcvm --help.');
        process.exit(1);
    }

    const funcBin = path.join(downloadDir, version, 'func');
    const funcBinWindows = path.join(downloadDir, version, 'func.exe');

    if (!fs.existsSync(funcBin) && !fs.existsSync(funcBinWindows)) {
        console.error(`func binary not found at ${funcBin}. Try running 'funcvm install ${version}' to repair.`);
        process.exit(1);
    }

    const funcProc = spawn(funcBin, args.slice(2), {
        stdio: [process.stdin, process.stdout, process.stderr, 'pipe']
    });

    funcProc.on('exit', code => {
        process.exit(code);
    });
}

main();