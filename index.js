#! /usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const Progress = require('node-fetch-progress');
const unzipper = require('unzipper');
const { getLocations, getPlatform, constants } = require('./common');
const args = process.argv.slice(2);

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
    const version = (args.length > 1 && (['use', 'install', 'remove'].includes(command))) ? args[1] : undefined;

    const { downloadDir } = await getLocations();

    const isUseCommand = command === 'use' && !!version;
    const isInstallCommand = command === 'install' && !!version;
    const isListCommand = command === 'list';
    const isRemoveCommand = command === 'remove';

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
    } else if (isRemoveCommand && !!version) {
        const versionDir = path.join(downloadDir, version);
        if (!fs.existsSync(versionDir)) {
            console.error(`Version '${version}' is not installed. Run 'funcvm list' to see installed versions.`);
            process.exit(1);
        }
        fs.rmdirSync(versionDir, { recursive: true });
        process.exit(0);
    } else if (!isUseCommand && !isInstallCommand) {
        console.log(`
Azure Functions Core Tools Version Manager (unofficial)

Usage: funcvm <command> [version]
        
Examples:

    Install and use latest stable 4.x version:
        funcvm use 4

    Install and use exact version:
        funcvm use 4.0.3928
        
    Install exact version:
        funcvm install 4.0.3928

    List installed versions:
        funcvm list
        
    Remove an installed version:
        funcvm remove 4.0.3928\n`);
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
        // hack for Windows, there's no x64 in the feed
        const archToFind = platform.os === 'Windows' ? 'x86' : platform.arch;
        const releaseCoreTool = release.coreTools.find(
            tool => tool.OS === platform.os && tool.Architecture === archToFind && tool.size == 'full');

        if (releaseCoreTool) {
            tagInfo.coreToolsUrl = releaseCoreTool.downloadLink;
            // hack for Windows, there's no x64 in the feed
            if (platform.os === 'Windows') {
                tagInfo.coreToolsUrl = tagInfo.coreToolsUrl.replace('x86', 'x64');
            }
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

        if (isInstallCommand) {
            console.log(`${tag.coreToolsVersion} installed. Run 'funcvm use ${tag.coreToolsVersion}' or set '${constants.versionEnvironmentVariableName}' environment variable to use it.`);
        }
    } else {
        if (isInstallCommand) {
            console.log(`${tag.coreToolsVersion} already installed. Run 'funcvm use ${tag.coreToolsVersion}' or set '${constants.versionEnvironmentVariableName}' environment variable to use it.`);
        }
    }
    
    if (isUseCommand) {
        fs.writeFileSync(path.join(downloadDir, 'funcvm-core-tools-version.txt'), tag.coreToolsVersion, 'utf8');
        console.log(`Using ${tag.coreToolsVersion}`);
    }
}

main();