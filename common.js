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

module.exports = {
    getLocations,
};