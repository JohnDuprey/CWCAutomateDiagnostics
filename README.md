# CWCAutomateDiagnostics
Run ConnectWise Automate agent diagnostics from ConnectWise Control. This extension utilizes the Labtech-Powershell-Module to review CWA agent settings and service statuses. The extension will also perform automatic service repairs and updates.

## Features
- Forces agent updates using Update-LTService
- Verifies LTService and LTSVCmon services are running and set to Automatic. Will start services and set StartMode to Automatic.
- Verifies checkin and heartbeat times.
- Stores the CWA Agent ID as CustomProperty6.
- Stores the CWA Version as CustomProperty7.
- Provides custom Session Group that sorts endpoints by CWA version number.

## Installation
- This extension has been submitted to ConnectWise for approval for the Marketplace

### Manual Instructions
1. Create a new directory for the extension - %programfiles(x86)%\ScreenConnect\App_Extensions\e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76
2. Download the lastest master.zip and extract all files into the directory 
3. Enable the extension in the administration page.

## Setup
1. In the settings, modify the PathToLTPoSh to a URL that you trust or one that is configured to bypass content filters
2. Additionally, find the Guid for the Control extension (manual one is listed above, cloud should be 26a42e0d-6233-4a66-9575-6e05a248cd26 once it's added to the marketplace)
3. Build the URL with the extension Guid and add that to the settings to avoid calling the script from GitHub. (e.g https://control_url:port/App_Extensions/<extension_guid>/AutomateDiagnostics.ps1)

## Usage
- Script is automatically executed on GuestConnect event (e.g. Service/Computer reboot). RanCommand events are parsed for JSON output and the version number is stored in CustomProperty7. Agent ID is stored as CustomProperty6. (NOTE: To rename the custom properties or reset the Session group, set the createdVersionSessionGroup setting to false)
- Script can be manually invoked from the Automate tab on the Host screen or in the drop down menu when selecting sessions.
![example](https://i.snag.gy/P21qyJ.jpg)

## Credit
- CTaylor's Labtech-Powershell-Module - https://github.com/LabtechConsulting/LabTech-Powershell-Module 
- MSPGeek Community - https://mspgeek.com 
- CWC Tags Extension for CustomProperty session group
- CWA Extension for CustomProperty setting via C#
- Diagnostics Extension for running powershell on remote endpoints and collecting/parsing output
