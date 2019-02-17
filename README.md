# CWCAutomateDiagnostics
Run ConnectWise Automate agent diagnostics from ConnectWise Control. This extension utilizes the Labtech-Powershell-Module to review CWA agent settings and service statuses with automatic repairs.

## Features
- Forces agent updates using Update-LTService
- Verifies LTService and LTSVCmon services are running and set to Automatic.
- Verifies checkin and heartbeat times

## Installation

1. Create a new directory for the extension - %programfiles(x86)%\ScreenConnect\App_Extensions\e4dd11eb-3c5e-407c-a7b8-a8ea5e6dbb76
2. Extract all files into directory and enable the extension in settings.

## Usage
- Script is automatically executed on GuestConnect event (e.g. Service/Computer reboot).
- Script can be manually invoked from the Automate tab on the Host screen.
![example](https://i.snag.gy/P21qyJ.jpg)

## Credit
- CTaylor's Labtech-Powershell-Module - https://github.com/LabtechConsulting/LabTech-Powershell-Module 
- MSPGeek Community - https://mspgeek.com 
