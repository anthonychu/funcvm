#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getLocations } = require('./common');
const args = process.argv;

const version = '4.0.3928';

async function main() {
    const { downloadDir } = await getLocations();
    
    const versionFile = path.join(downloadDir, 'funcvm-core-tools-version.txt');
    let version;
    if (fs.existsSync(versionFile)) {
        version = fs.readFileSync(versionFile, 'utf8');
    } else {
        console.error('funcvm not initialized. Run funcvm --help.');
        process.exit(1);
    }

    const funcBin = path.join(downloadDir, version, 'func');
    
    if (!fs.existsSync(funcBin)) {
        console.error(`func binary not found at ${funcBin}`);
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