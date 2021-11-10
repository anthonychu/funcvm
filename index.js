#! /usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');
const fetch = require('node-fetch');
const Progress = require('node-fetch-progress');
const unzipper = require('unzipper');
const { getLocations, getPlatform, constants } = require('./common');
const JSON5 = require('json5');
const args = process.argv.slice(2);

async function downloadAndUnzip(url, dest) {
    const response = await fetch(url);
    const progress = new Progress(response, { throttle: 100 })
    let prevEta;
    progress.on('progress', (p) => {
        if (prevEta !== p.etah) {
            console.log(p.etah + ' remaining');
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
        const versions = fs.readdirSync(downloadDir).filter(v => /^\d+\.\d+\.\d+/.test(v) && fs.lstatSync(path.join(downloadDir, v)).isDirectory());
        const versionFile = path.join(downloadDir, 'funcvm-core-tools-version.txt');
        const localVersionFile = path.join(process.cwd(), '.func-version');
        let currentVersion, localVersion;
        if (fs.existsSync(versionFile)) {
            currentVersion = fs.readFileSync(versionFile, 'utf8').trim();
        }
        if (fs.existsSync(localVersionFile)) {
            localVersion = fs.readFileSync(localVersionFile, 'utf8').trim();
        }
        if (args.includes('--remote')) {
            const feedResponse = await fetch("https://aka.ms/AAeq1v7");
            const feed = await feedResponse.json();
            const releases = {};
            for (const [, releaseInfo] of Object.entries(feed.releases).sort()) {
                const coreTool = releaseInfo.coreTools.find(tools => tools.OS === getPlatform().os);
                if (!coreTool) {
                    continue;
                };
                try {
                    const version = coreTool.downloadLink.match(/\d+\.\d+\.\d+/)[0];
                    if (releases[version]) {
                        continue;
                    };
                    const tags = [];
                    process.env[constants.versionEnvironmentVariableName] === version && tags.push('env');
                    localVersion === version && tags.push('local');
                    currentVersion === version && tags.push('global');
                    !versions.includes(version) && tags.length > 0 && tags.push('not installed');
                    versions.includes(version) && tags.length === 0 && tags.push('installed');
                    releases[version] = `${tags.length > 0 ? ` (${tags.join(', ')})`: ''}`;
                } catch { }
            }
            console.log(Object.entries(releases).sort((r1, r2) => r1[0] > r2[0] ? 1 : -1).map(r => r.join(' ')).join('\n'));
            process.exit(0);
        }
        for (const version of versions) {
            const tags = [];
            process.env[constants.versionEnvironmentVariableName] === version && tags.push('env');
            localVersion === version && tags.push('local');
            currentVersion === version && tags.push('global');
            console.log(`${version}${tags.length > 0 ? ` (${tags.join(', ')})`: ''}`);
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

    Install and use latest stable 3.x version:
        funcvm use 3

    Install and use exact version:
        funcvm use 4.0.3928

    Install and use the version only for the current directory:
        funcvm use 4.0.3928 --local

    Install exact version:
        funcvm install 4.0.3928

    List installed versions:
        funcvm list

    List published versions:
        funcvm list --remote

    Remove an installed version:
        funcvm remove 4.0.3928\n`);
        process.exit(0);
    }

    const feedResponse = await fetch("https://aka.ms/AAeq1v7");
    const feedText = await feedResponse.text();
    const feed = JSON5.parse(feedText);

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

        if (!releaseCoreTool) {
            continue;
        }
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

        const releaseText = await releaseResponse.text();
        const release = JSON5.parse(releaseText);
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
        const localVersionFile = path.join(process.cwd(), '.func-version');
        if (args.includes('--local')) {
            fs.writeFileSync(localVersionFile, tag.coreToolsVersion, 'utf8');
        } else {
            if (fs.existsSync(localVersionFile)) {
                console.log(`Local version file '${localVersionFile}' already exists. Remove it or use 'funcvm use ${tag.coreToolsVersion} --local' to update it.`);
                process.exit(1);
            }
            fs.writeFileSync(path.join(downloadDir, 'funcvm-core-tools-version.txt'), tag.coreToolsVersion, 'utf8');
        }
        console.log(`Using ${tag.coreToolsVersion}`);
    }
}

main();