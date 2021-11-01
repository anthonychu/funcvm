const path = require('path');
const os = require('os');

function getLocations() {
    const funcvmDir = path.join(os.homedir(), '.funcvm');
    const downloadDir = path.join(funcvmDir, 'download');

    return {
        funcvmDir,
        downloadDir,
    };
}

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

const constants = {
    versionEnvironmentVariableName: 'FUNCVM_CORE_TOOLS_VERSION',
};

module.exports = {
    getLocations,
    getPlatform,
    constants,
};