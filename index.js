#! /usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const Progress = require('node-fetch-progress');
const unzipper = require('unzipper');
const { getLocations } = require('./common');
const args = process.argv.slice(2);

function getPlatform() {
    switch (os.platform()) {
        case 'win32':
            return {
                os: 'Windows',
                arch: 'x64',
                label: 'win-x64',
            };
        case 'darwin':
            return {
                os: 'MacOS',
                arch: 'x64',
                label: 'osx-x64',
            };
        case 'linux':
            return {
                os: 'Linux',
                arch: 'x64',
                label: 'linux-x64',
            };
        default:
            throw new Error(`Unsupported platform: ${os.platform()}`);
    }
}

async function downloadAndUnzip(url, dest) {
    const response = await fetch(url);
    const progress = new Progress(response, { throttle: 100 })
    let prevEta;
    progress.on('progress', (p) => {
        if (prevEta !== p.etah) {
            console.log(p.etah);
            prevEta = p.etah;
        }
    });
    await new Promise((resolve, reject) => {
        const unzipperInstance = unzipper.Extract({ path: dest });
        unzipperInstance.promise().then(resolve, reject);
        response.body.pipe(unzipperInstance);
    });
}

async function main() {
    const command = args.length > 0 ? args[0] : 'help';
    const version = args.length > 1 && command === 'use' ? args[1] : undefined;

    const { downloadDir } = await getLocations();

    const isUseCommand = command === 'use' && !!version;
    const isListCommand = command === 'list';

    if (isListCommand) {
        const versions = fs.readdirSync(downloadDir);
        const versionFile = path.join(downloadDir, 'funcvm-core-tools-version.txt');
        let currentVersion;
        if (fs.existsSync(versionFile)) {
            currentVersion = fs.readFileSync(versionFile, 'utf8');
        }
        for (const version of versions) {
            if (/^\d+\.\d+\.\d+/.test(version) && fs.lstatSync(path.join(downloadDir, version)).isDirectory()) {
                console.log(version + (currentVersion === version ? ' (selected)' : ''));
            }
        }
        process.exit(0);
    } else if (!isUseCommand && !isListCommand) {
        console.log(`
Azure Functions Core Tools Version Manager (unofficial)

Usage: funcvm <command> <version>
        
Examples:

    Use latest stable 4.x version:
        funcvm use 4

    Use exact version:
        funcvm use 4.0.3928
        
    List installed versions:
        funcvm list\n`);
        process.exit(0);
    }

    const feedResponse = await fetch("https://aka.ms/AAbbk68");
    const feed = await feedResponse.json();

    const feedTags = feed.tags;
    const tags = {};
    const platform = getPlatform();

    for (const [tagName, tagInfo] of Object.entries(feedTags)) {
        if (tagInfo.hidden) {
            continue;
        }

        const releaseVersion = tagInfo.release;
        const release = feed.releases[releaseVersion];
        const releaseCoreTool = release.coreTools.find(
            tool => tool.OS === platform.os && tool.Architecture === platform.arch && tool.size == 'full');

        if (releaseCoreTool) {
            tagInfo.coreToolsUrl = releaseCoreTool.downloadLink;
            const match = releaseCoreTool.downloadLink.match(/\/(\d+\.\d+\.\d+)\//);
            if (match) {
                tagInfo.coreToolsVersion = match[1];
            }
            tags[tagName] = tagInfo;
        }
    }

    let tag = tags[`v${version}`];

    if (!tag) {
        tag = Object.values(tags).find(tag => tag.coreToolsVersion === version);
    }

    if (!tag) {
        // check GitHub releases
        const releaseResponse = await fetch(`https://api.github.com/repos/Azure/azure-functions-core-tools/releases/tags/${version}`);
        if (releaseResponse.status !== 200) {
            console.error(`Unable to find version ${version} on GitHub releases https://github.com/Azure/azure-functions-core-tools/releases`);
            process.exit(1);
        }

        const release = await releaseResponse.json();
        const name = `Azure.Functions.Cli.${platform.label}.${version}.zip`;
        const asset = release.assets.find(asset => asset.name === name);

        if (!asset) {
            console.error(`Unable to find suitable asset for ${platform.label} on GitHub releases https://github.com/Azure/azure-functions-core-tools/releases/tag/${version}`);
            process.exit(1);
        }

        const coreToolsUrl = asset.browser_download_url;
        tag = {
            coreToolsUrl,
            coreToolsVersion: version,
        };
    }

    const versionDownloadDir = path.join(downloadDir, tag.coreToolsVersion);

    if (!fs.existsSync(versionDownloadDir)) {
        console.log(`Downloading ${tag.coreToolsUrl} to ${versionDownloadDir}...`);

        await downloadAndUnzip(tag.coreToolsUrl, versionDownloadDir);
        const funcBin = path.join(versionDownloadDir, 'func');
        if (os.platform() === 'linux' || os.platform() === 'darwin') {
            fs.chmodSync(funcBin, 0o755);
            fs.chmodSync(path.join(versionDownloadDir, 'gozip'), 0o755);
        }
    }
    
    fs.writeFileSync(path.join(downloadDir, 'funcvm-core-tools-version.txt'), tag.coreToolsVersion, 'utf8');
    console.log(`Using ${tag.coreToolsVersion}`);
}

main();