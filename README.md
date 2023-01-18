# CWCAutomateDiagnostics
Run ConnectWise Automate agent diagnostics from ConnectWise Control. This extension utilizes the Labtech-Powershell-Module to review CWA agent settings and service statuses. The extension will also perform automatic service repairs and updates.

<img src="https://raw.githubusercontent.com/johnduprey/CWCAutomateDiagnostics/master/Promote.png" width="200" />

## Features
- NEW - LTErrors.txt / agent.log file is returned in the diagnostic
- NEW - /usr/local/ltechagent/ltupdate initiated from AutomateDiagnostics.py
- Maintenance Mode - Disable diagnostics on GuestConnect event
- Mac OS X/Linux Agent Reporting
- Forces agent updates using Update-LTService
- Verifies LTService and LTSVCmon services are running and set to Automatic. Will start services and set StartMode to Automatic.
- Verifies checkin and heartbeat times.
- Stores the CWA Agent ID as CustomProperty6 (customizable).
- Stores the CWA Version as CustomProperty7 (customizable).
- Provides custom Session Group that sorts endpoints by CWA version number.
- Repair option now uses InstallerToken, generate a long lived one using this script https://www.mspgeek.com/files/file/50-generate-agent-installertoken/.

## Installation
- Install Automate Diagnostics from the ConnectWise Control Marketplace (version 1.0.6.7)

### Manual Instructions
> To install this version, 1.0.7.2:
1. Create a new directory for the extension - %programfiles(x86)%\ScreenConnect\App_Extensions\e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76
2. Download the lastest master.zip and extract all files into the directory 
3. Enable the extension in the administration page.

## Setup
1. In the settings, modify the PathToLTPoSh to a URL that you trust or one that is configured to bypass content filters
2. Additionally, find the Guid for the Control extension (manual one is listed above, cloud is 26a42e0d-6233-4a66-9575-6e05a248cd26)
3. Build the URL with the extension Guid and add that to the settings to avoid calling the script from GitHub. (e.g https://control_url:port/App_Extensions/<extension_guid>/AutomateDiagnostics.ps1)
4. Edit the Control web.config file (make a backup first): Under the `<httpHandlers>` section, add verb entries for each script file:

```
<add verb="GET,HEAD" path="App_Extensions/e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76/AutomateDiagnostics.ps1" type="System.Web.DefaultHttpHandler" />
<add verb="GET,HEAD" path="App_Extensions/e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76/AutomateDiagnostics.py" type="System.Web.DefaultHttpHandler" />
<add verb="GET,HEAD" path="App_Extensions/e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76/AutomateDiagnostics.sh" type="System.Web.DefaultHttpHandler" />
```

## Usage
- Script is automatically executed on GuestConnect event (e.g. Service/Computer reboot). RanCommand events are parsed for JSON output and the version number is stored in CustomProperty7. Agent ID is stored as CustomProperty6. (NOTE: To rename the custom properties or reset the Session group, set the createdVersionSessionGroup setting to false, also do this if you change the custom property value number)
- Script can be manually invoked from the Automate tab on the Host screen or in the drop down menu when selecting sessions.

## Sample Output

| Diagnostic Details  | Agent Logs |
| ------------- | ------------- |
| ![Details](https://user-images.githubusercontent.com/41485711/212959588-a29b5173-bf9f-427d-9ae8-47a5c2593143.png) | ![LTRrrors](https://user-images.githubusercontent.com/41485711/212806625-1f95e9a1-3c16-489b-9219-5a90a36a4f3f.png) |


## Troubleshooting
Set Verbose = 1 in the Extension settings to log more data for on-demand diagnostics. This does not apply to Guest Connect events.

## Credit
- CTaylor's Labtech-Powershell-Module - https://github.com/LabtechConsulting/LabTech-Powershell-Module
- Noah Tatum - AutomateDiagnostics.sh - https://github.com/noaht8um/CWCAutomateDiagnostics/blob/master/AutomateDiagnostics.sh
- Joe McCall - Bug fixes for CW Control 22.9+
- MSPGeek Community - https://mspgeek.com 
- CWC Tags Extension for CustomProperty session group
- CWA Extension for CustomProperty setting via C#
- Diagnostics Extension for running powershell on remote endpoints and collecting/parsing output
