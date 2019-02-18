# CWCAutomateDiagnostics
Run ConnectWise Automate agent diagnostics from ConnectWise Control. This extension utilizes the Labtech-Powershell-Module to review CWA agent settings and service statuses. The extension will also perform automatic repairs.

## Features
- Forces agent updates using Update-LTService
- Verifies LTService and LTSVCmon services are running and set to Automatic.
- Verifies checkin and heartbeat times

## Installation
1. Download the latest release zip and extract into %programfiles(x86)%\ScreenConnect\App_Extensions\
2. Enable the extension in the administration page.

OR

1. Create a new directory for the extension - %programfiles(x86)%\ScreenConnect\App_Extensions\e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76
2. Download the lastest master zip and extract all files into the directory 
3. Enable the extension in the administration page.

## Usage
- Script is automatically executed on GuestConnect event (e.g. Service/Computer reboot).
- Script can be manually invoked from the Automate tab on the Host screen.
![example](https://i.snag.gy/P21qyJ.jpg)

## Credit
- CTaylor's Labtech-Powershell-Module - https://github.com/LabtechConsulting/LabTech-Powershell-Module 
- MSPGeek Community - https://mspgeek.com 
