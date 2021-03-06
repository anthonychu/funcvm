# Azure Functions Core Tool Version Manager (funcvm)

[![npm](https://img.shields.io/badge/npm-%40anthonychu%2Ffuncvm-lightgrey)](https://www.npmjs.com/package/@anthonychu/funcvm)

funcvm installs and manages Azure Functions Core Tool versions. This tool is not officially supported by Microsoft.

Use it to:

* Quickly switch between different versions of Azure Functions Core Tools
* Use prerelease versions of Azure Functions Core Tools
* Use different versions of Azure Functions Core Tools in different projects

## Installation

**Important: Uninstall all previously installed versions of Azure Functions Core Tools before using funcvm.**

To check if you have any versions of Azure functions Core Tools already installed, run the following command and uninstall any versions that are listed:

```bash
# macOS or Linux
which func

# Windows PowerShell
Get-Command func

# Windows Command Prompt
where func
```

Install funcvm with the following command:

```bash
npm install -g @anthonychu/funcvm
```

## Usage

### Use latest stable version

Install and use the latest stable 4.x version of Azure Functions Core Tools:

```bash
funcvm use 4

# confirm that it's correctly installed
func --version
```

### Use a specific version

Install and use a specific version of Azure Functions Core Tools:

```bash
funcvm use 3.0.3785
```

You can find all available versions, including prerelease versions, by checking [GitHub releases](https://github.com/Azure/azure-functions-core-tools/releases).

### Use a different version than the currently selected version

#### Environment variable

You can set the `FUNCVM_CORE_TOOLS_VERSION` environment variable to use a different version of Azure Functions Core Tools than the currently selected version.

```bash
export FUNCVM_CORE_TOOLS_VERSION=3.0.3873
func --version
# this should print 3.0.3873
```

#### Local version file

You can save a file named `.func-version` in any folder to use a different version of Azure Functions Core Tools than the globally selected version.

```bash
funcvm use 4 --local
```

---

**Note:** This is a community open source project that is not officially supported by Microsoft.

