SC.event.addGlobalHandler(SC.event.PreRender, function (eventArgs) {
	if (SC.context.pageType == 'HostPage') {
        SC.util.includeStyleSheet(extensionContext.baseUrl + 'DiagnosticsNewStyle.css');
    }
});

function getLTPoSh() {
	return extensionContext.settingValues.PathToLTPoSh;
}
function getAutomateDiagnosticsURL() {
	return extensionContext.settingValues.PathToDiag;
}
function getLinuxDiagnosticsURL() {
	return extensionContext.settingValues.PathToMacLinuxDiag;
}
function getLTServer() {
	return extensionContext.settingValues.AutomateHostname;
}

SC.event.addGlobalHandler(SC.event.QueryCommandButtons, function (eventArgs) {
	switch (eventArgs.area) {
		case 'HostDetailTabList':
			eventArgs.buttonDefinitions.push(
				{commandName: 'Select', commandArgument: 'Automate', text: SC.res['Diagnostics.Automate.Label'], imageUrl: extensionContext.baseUrl + 'Automate.png'}
			);
			break;
		case 'HostDetailPopoutPanel':eventArgs.buttonDefinitions.push({commandName: 'GetInfoPer', commandArgument: 'Automate', text: SC.res['Diagnostics.Automate.Button']});
			break;
		case 'AutomateButtons':eventArgs.buttonDefinitions.push({commandName: 'GetInfo', commandArgument: 'Automate', text: SC.res['Diagnostics.Automate.Button']});
			break;
	}
});

SC.event.addGlobalHandler(SC.event.InitializeTab, function (eventArgs) {
	if (isMyTab(eventArgs.tabName))	{
		SC.command.queryAndAddCommandButtons(eventArgs.container, eventArgs.tabName + 'Buttons');
		SC.ui.addElement(eventArgs.container, 'DIV', {id: 'lastUpdateContainer'});
		SC.ui.addElement(eventArgs.container, 'DIV', {id: 'dataContainer'});
		SC.ui.addElement(eventArgs.container, 'TABLE', {id: 'dataTable'});
	}
});

SC.event.addGlobalHandler(SC.event.RefreshTab, function (eventArgs) {
	if (isMyTab(eventArgs.tabName)) {
		SC.ui.clear($('dataContainer'));
		SC.ui.clear($('lastUpdateContainer'));
		SC.ui.clear($('dataTable'));
		
		SC.ui.findDescendent(
			eventArgs.container, function(e) { 
				return e._commandName == 'GetInfo'; 
			}
		)._commandArgument = {
			type: eventArgs.tabName, 
			operatingSystemName: eventArgs.session.GuestOperatingSystemName 
		};
			
		displayDiagnosticInformation(
			getLatestDiagnosticEvent(
				eventArgs.sessionDetails, 
				eventArgs.tabName
				), eventArgs.sessionDetails.BaseTime
			);
			
	}
});

SC.event.addGlobalHandler(SC.event.ExecuteCommand, function (eventArgs) {
	switch (eventArgs.commandName){
		case 'GetInfo':
			window.addEventToSessions(
				window.getSessionGroupUrlPart()[0], 
				SC.types.SessionType.Access,
				[window.getSessionUrlPart()], 
				SC.types.SessionEventType.QueuedCommand, 
				null,
				getInputCommand(
					eventArgs.commandArgument.type, 
					eventArgs.commandArgument.operatingSystemName
					),
				false,
				false,
				true
			);
			break;
		case 'GetInfoPer':
			var checkedOrSelectedRows = Array.prototype.filter.call(($('detailTable') || $('.DetailTable')).rows, function (r) { return SC.ui.isChecked(r) || SC.ui.isSelected(r); });
			var checkedOrSelectedSessions = Array.prototype.map.call(checkedOrSelectedRows, function (r) { return r._dataItem; });
			var sessionType = checkedOrSelectedSessions[0].SessionType === undefined ? SC.types.SessionTypes.Access : checkedOrSelectedSessions[0].SessionType;
			var windowsSessionIDs = Array.prototype.map.call(checkedOrSelectedSessions, function (s) { if (s.GuestOperatingSystemName.includes("Windows")) return s.SessionID; }).filter(function(s){return s !== undefined});
			var linuxMacSessionIDs = Array.prototype.map.call(checkedOrSelectedSessions, function (s) { if (!s.GuestOperatingSystemName.includes("Windows")) return s.SessionID; }).filter(function(s){return s !== undefined});
			window.addEventToSessions(window.getSessionGroupUrlPart()[0], SC.types.SessionType.Access, windowsSessionIDs, SC.types.SessionEventType.QueuedCommand, null, getInputCommand('Automate', 'Windows'),	false, false, true);
			window.addEventToSessions(window.getSessionGroupUrlPart()[0], SC.types.SessionType.Access, linuxMacSessionIDs, SC.types.SessionEventType.QueuedCommand, null, getInputCommand('Automate', 'Linux'), false, false, true);
			break;
	}
});

SC.event.addGlobalHandler(SC.event.PreRender, function (eventArgs) {
	if (!extensionContext.settingValues.createdVersionSessionGroup) {
		SC.service.NotifyCreatedVersionSessionGroup();
		SC.service.SetVersionCustomProperties(function () {
			SC.pagedata.notifyDirty();
		});

		SC.service.GetSessionGroups(function (sessionGroups) {
			for (var sessionTypesAsString = ['Sessions', 'Meetings', 'Machines'], sessionType = 0 ; sessionType < sessionTypesAsString.length; sessionType++) {
				var name = "All " + sessionTypesAsString[sessionType] + " by CWA Version";

				if (!sessionGroups.find(function (session) { return session.Name === name })) {
					sessionGroups.push({
						Name: name,
						SessionFilter: "NOT CustomProperty7 = ''",
						SessionType: sessionType,
						SubgroupExpressions: 'CustomProperty7'
					});
				}
			}

			SC.service.SaveSessionGroups(sessionGroups);
		});
	}
});

function getInputCommand(diagnosticType, operatingSystem) {
	var headers = getHeaders(operatingSystem);
	headers.DiagnosticType = diagnosticType;
	var commandText = getDiagnosticCommandText(headers);
	
	var emptyLinePrefix = '';
	
	if (headers.Processor == 'sh') 
		emptyLinePrefix = 'echo ';
	else{
		emptyLinePrefix = 'echo ""';
	}
	
	return  "#!" + headers.shaBang + "\n" +
		"#maxlength=100000" + "\n" +
		"#timeout=600000" + "\n" +
		headers.modifier + "DIAGNOSTIC-RESPONSE/1" + headers.delimiter  + "\n" +
		headers.modifier + "DiagnosticType: " + headers.DiagnosticType + headers.delimiter  + "\n" +
		headers.modifier + "ContentType: " + headers.ContentType + headers.delimiter  + "\n" +
		emptyLinePrefix + "\n" + commandText;
}

function getHeaders(operatingSystem) {
	console.log(operatingSystem);
	if (operatingSystem.startsWith("Windows")) {
		return { Processor: "ps", Interface: "powershell", ContentType: "json", shaBang: "ps", modifier: "echo \"", delimiter: '\"' };
	}
	else {
		return { Processor: "sh", Interface: "bash", ContentType: "json", shaBang: "sh", modifier: "echo ", delimiter: '' };
	}
}

function isMyTab(tabName) {
	switch (tabName) {
		case 'Automate':
			return true;
		default:
			return false;
	}
}

function isDiagnosticContent(eventData) {
	return (eventData.startsWith("DIAGNOSTIC-RESPONSE/1") || eventData.startsWith("\ufeffDIAGNOSTIC-RESPONSE/1") ? true : false);
}

function getLatestDiagnosticEvent(sessionDetails, diagnosticEventType) {
	return sessionDetails.Connections
			.map(function(c) { return c.Events; })
			.reduce(function(outputArray, events) { Array.prototype.push.apply(outputArray, events); return outputArray; }, [])
			.filter(function(e) { 
				return e.EventType === SC.types.SessionEventType.RanCommand &&
					isDiagnosticContent(e.Data) &&
					parseDataHeaders(e.Data).DiagnosticType.trim() == diagnosticEventType;
			})
			.sort(function (x, y) { return x.Time - y.Time; })
			[0];
}

function parseDataHeaders(eventData) {
	var currentIndex = 0;
	var headers = {};
	var isStatusLine = true;
	
	while (true) {
		var nextNewLineIndex = eventData.indexOf('\n', currentIndex);
		
		if (isStatusLine) {
			isStatusLine = false;
		} else if (nextNewLineIndex == currentIndex + 2 || nextNewLineIndex < 0) {
			break;
		} else {
			var lineParts = eventData.substring(currentIndex, nextNewLineIndex).split(': ');
			headers[lineParts[0]] = lineParts[1];
		}
		currentIndex = nextNewLineIndex + 1;
	}
	return headers;
}

function displayDiagnosticInformation(latestDiagnosticEvent, baseTime) {
	var headers = parseDataHeaders(latestDiagnosticEvent.Data);
	var output = latestDiagnosticEvent.Data;
	var data = output.split("!---BEGIN JSON---!");
	console.log(data[1]);
	displayDataJson(parseJson(data[1]));	
	$('lastUpdateContainer').innerHTML = SC.res['Diagnostics.LastUpdateField.Label'] + new Date(latestDiagnosticEvent.Time + baseTime);
}

function parseJson(eventData) {
	var json = JSON.parse(eventData);
	console.log(json);
	return json;
}


function displayDataJson(json) {
	if ("ltposh_loaded" in json) {
		SC.ui.addElement($('dataTable'), 'tr', {id: 'ltposh_row'});
		SC.ui.addElement($('ltposh_row'), 'th', {id: 'ltposh_hdr', innerHTML: 'LTPosh Loaded'});
		SC.ui.addElement($('ltposh_row'), 'td', {id: 'ltposh', innerHTML: (json["ltposh_loaded"]) ? "<span class='success'>✓</span>":"<span class='failed'>✗</span>"});
	}
	if ("server_addr" in json) {
		if (!/Error/i.test(json["server_addr"])) { var server_status = "<span class='success'>✓</span>"; } else { var server_status = "<span class='failed'>✗</span>"; }
		SC.ui.addElement($('dataTable'), 'tr', {id: 'server_row'});
		SC.ui.addElement($('server_row'), 'th', {id: 'server_hdr', innerHTML: 'Server Check'});
		SC.ui.addElement($('server_row'), 'td', {id: 'server', innerHTML: server_status + " " + json["server_addr"], colspan: 2});
	}
	if ("id" in json) {
		if (json["id"] > 0) { var agentid_status = "<span class='success'>✓</span>"; } else { var agentid_status = "<span class='failed'>✗</span>"; }
		SC.ui.addElement($('dataTable'), 'tr', {id: 'agent_id_row'});
		SC.ui.addElement($('agent_id_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'Agent ID'});
		SC.ui.addElement($('agent_id_row'), 'td', {id: 'agent_id', innerHTML: agentid_status + " " + json["id"]});
	}
	if ("update" in json) {
		if (!/Error/i.test(json["update"])) { var update_status = "<span class='success'>✓</span>"; } else { var update_status = "<span class='failed'>✗</span>"; }
		SC.ui.addElement($('dataTable'), 'tr', {id: 'update_row'});
		SC.ui.addElement($('update_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'Update Check'});
		SC.ui.addElement($('update_row'), 'td', {id: 'agent_id', innerHTML: update_status + " " + json["update"], colspan: 2});
	}
	if ("online" in json) {
		var online_status = (json["online"]) ? "<span class='success'>✓</span>":"<span class='failed'>✗</span>";
		SC.ui.addElement($('dataTable'), 'tr', {id: 'status_row'});
		SC.ui.addElement($('status_row'), 'th', {id: 'status_hdr', innerHTML: 'Checkin Health'});
		SC.ui.addElement($('status_row'), 'td', {id: 'status', innerHTML: online_status + " " + json['lastcontact']});
	}
	if ("heartbeat" in json) {
		var heartbeat_status = (json["heartbeat"]) ? "<span class='success'>✓</span>":"<span class='failed'>✗</span>";
		SC.ui.addElement($('dataTable'), 'tr', {id: 'status_row2'});
		SC.ui.addElement($('status_row2'), 'th', {id: 'status_hdr2', innerHTML: 'Heartbeat Health'});
		SC.ui.addElement($('status_row2'), 'td', {id: 'status2', innerHTML: heartbeat_status + " " + json["heartbeat_sent"]});
	}
	if ("svc_ltservice" in json) {
		var ltservice_txt = json["svc_ltservice"]["Status"] + " | " + json["svc_ltservice"]["Start Mode"] + " | " + json["svc_ltservice"]["User"];
		if (json["svc_ltservice"]["Status"] == "Running" && json["svc_ltservice"]["Start Mode"] == "Auto") { var ltservice_status = "<span class='success'>✓</span>"; } else { var ltservice_status = "<span class='failed'>✗</span>"; }
		SC.ui.addElement($('dataTable'), 'tr', {id: 'ltsvc_row'});
		SC.ui.addElement($('ltsvc_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'SVC - LTService'});
		SC.ui.addElement($('ltsvc_row'), 'td', {id: 'ltsvc', innerHTML: ltservice_status + " " + ltservice_txt});
	}
	if ("svc_ltsvcmon" in json) {
		var ltsvcmon_txt =  json["svc_ltsvcmon"]["Status"] + " | " + json["svc_ltsvcmon"]["Start Mode"] + " | " + json["svc_ltsvcmon"]["User"];
		if (json["svc_ltsvcmon"]["Status"] == "Running" && json["svc_ltsvcmon"]["Start Mode"] == "Auto") { var ltsvcmon_status = "<span class='success'>✓</span>"; } else { var ltsvcmon_status = "<span class='failed'>✗</span>"; }
		SC.ui.addElement($('dataTable'), 'tr', {id: 'ltsvcmon_row'});
		SC.ui.addElement($('ltsvcmon_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'SVC - LTSVCMon'});
		SC.ui.addElement($('ltsvcmon_row'), 'td', {id: 'ltsvc', innerHTML: ltsvcmon_status + " " + ltsvcmon_txt});
	}
	if ("repair" in json) {
		SC.ui.addElement($('dataTable'), 'tr', {id: 'repair_row'});
		SC.ui.addElement($('repair_row'), 'th', {id: 'repair_hdr', innerHTML: 'Recommended repair'});
		SC.ui.addElement($('repair_row'), 'td', {id: 'repair', innerHTML: json["repair"], colspan: 2});
	}
}

function isUsingInternetExplorerOrEdge() {
	var ua = window.navigator.userAgent;
	var msie = ua.indexOf("Trident");
	
	if (ua.indexOf("Trident") > 0 || ua.indexOf("Edge") > 0)
		return true;
	else
		return false;
}

//ripped directly from http://stackoverflow.com/questions/6108819/javascript-timestamp-to-relative-time-eg-2-seconds-ago-one-week-ago-etc-best
function timeDifference(current, previous) {
    var msPerMinute = 60 * 1000;
    var msPerHour = msPerMinute * 60;
    var msPerDay = msPerHour * 24;
    var msPerMonth = msPerDay * 30;
    var msPerYear = msPerDay * 365;

    var elapsed = current - previous;

    if (elapsed < msPerMinute) 
         return Math.abs(Math.round(elapsed/1000)) + ' seconds ago';   
    else if (elapsed < msPerHour) 
         return Math.round(elapsed/msPerMinute) + ' minutes ago';   
    else if (elapsed < msPerDay ) 
         return Math.round(elapsed/msPerHour ) + ' hours ago';   
    else if (elapsed < msPerMonth) 
        return 'approximately ' + Math.round(elapsed/msPerDay) + ' days ago';   
    else if (elapsed < msPerYear) 
        return 'approximately ' + Math.round(elapsed/msPerMonth) + ' months ago';   
    else 
        return 'approximately ' + Math.round(elapsed/msPerYear ) + ' years ago';   
}

function getDiagnosticCommandText(headers) {
	switch (headers.Processor + '/' + headers.Interface + '/' + headers.ContentType + '/' + headers.DiagnosticType)
	{
		case "ps/powershell/json/Automate": return "$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12}; [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; Try { (new-object Net.WebClient).DownloadString('"+getAutomateDiagnosticsURL()+"') | iex; Start-AutomateDiagnostics -ltposh '"+getLTPoSh()+"' -automate_server '"+getLTServer()+"'} Catch { $_.Exception.Message; Write-Host '!---BEGIN JSON---!'; Write-Host '{\"version\": \"Error loading AutomateDiagnostics\"}' }"; break;
		case "sh/bash/json/Automate": return "curl -s "+getLinuxDiagnosticsURL()+" | python"; break;
    	default: throw "unknown os";
	}
}

