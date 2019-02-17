SC.event.addGlobalHandler(SC.event.PreRender, function (eventArgs) {
	if (SC.context.pageType == 'HostPage') {
        SC.util.includeStyleSheet(extensionContext.baseUrl + 'DiagnosticsNewStyle.css');
    }
});

function getLTPoSh() {
	return extensionContext.settingValues.PathToLTPoSh;
}

SC.event.addGlobalHandler(SC.event.QueryCommandButtons, function (eventArgs) {
	switch (eventArgs.area) {
		case 'HostDetailTabList':
			eventArgs.buttonDefinitions.push(
				{commandName: 'Select', commandArgument: 'Automate', text: SC.res['Diagnostics.Automate.Label'], imageUrl: extensionContext.baseUrl + 'Images/Automate.png'}
			);
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
		"#timeout=90000" + "\n" +
		headers.modifier + "DIAGNOSTIC-RESPONSE/1" + headers.delimiter  + "\n" +
		headers.modifier + "DiagnosticType: " + headers.DiagnosticType + headers.delimiter  + "\n" +
		headers.modifier + "ContentType: " + headers.ContentType + headers.delimiter  + "\n" +
		emptyLinePrefix + "\n" + commandText;
}

function getHeaders(operatingSystem) {
	return { Processor: "ps", Interface: "powershell", ContentType: "json", shaBang: "ps", modifier: "echo \"", delimiter: '\"' };
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
	displayDataJson(parseJson(latestDiagnosticEvent.Data));	
	$('lastUpdateContainer').innerHTML = SC.res['Diagnostics.LastUpdateField.Label'] + new Date(latestDiagnosticEvent.Time + baseTime);
}

function parseJson(eventData) {
	var lines=eventData.split('\n');
	var json_text = "";
	for(var i=3;i<lines.length;i++){
		json_text = json_text + "\n" + lines[i];
	}
	var json = JSON.parse(json_text);
	console.log(json);
	return json;
}


function displayDataJson(json) {
	SC.ui.addElement($('dataTable'), 'tr', {id: 'server_row'});
	SC.ui.addElement($('server_row'), 'th', {id: 'server_hdr', innerHTML: 'Server Address'});
	SC.ui.addElement($('server_row'), 'td', {id: 'server', innerHTML: json["server_addr"], colspan: 2});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'agent_id_row'});
	SC.ui.addElement($('agent_id_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'Agent ID'});
	SC.ui.addElement($('agent_id_row'), 'td', {id: 'agent_id', innerHTML: json["id"]});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'update_row'});
	SC.ui.addElement($('update_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'Update Check'});
	SC.ui.addElement($('update_row'), 'td', {id: 'agent_id', innerHTML: json["update"], colspan: 2});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'status_row'});
	SC.ui.addElement($('status_row'), 'th', {id: 'status_hdr', innerHTML: 'Checkin Health'});
	SC.ui.addElement($('status_row'), 'td', {id: 'status', innerHTML: (json["online"]) ? "<span class='success'>✓</span>":"<span class='failed'>✗</span>"});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'status_row2'});
	SC.ui.addElement($('status_row2'), 'th', {id: 'status_hdr2', innerHTML: 'Heartbeat Health'});
	SC.ui.addElement($('status_row2'), 'td', {id: 'status2', innerHTML: (json["heartbeat"]) ? "<span class='success'>✓</span>":"<span class='failed'>✗</span>"});
	
	SC.ui.addElement($('dataTable'), 'tr', {id: 'ltsvc_row'});
	SC.ui.addElement($('ltsvc_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'SVC - LTService'});
	SC.ui.addElement($('ltsvc_row'), 'td', {id: 'ltsvc', innerHTML: json["svc_ltservice"]["Status"] + " | " + json["svc_ltservice"]["Start Mode"]});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'ltsvcmon_row'});
	SC.ui.addElement($('ltsvcmon_row'), 'th', {id: 'agent_id_hdr', innerHTML: 'SVC - LTSVCMon'});
	SC.ui.addElement($('ltsvcmon_row'), 'td', {id: 'ltsvc', innerHTML: json["svc_ltsvcmon"]["Status"] + " | " + json["svc_ltsvcmon"]["Start Mode"]});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'last_contact_row'});
	SC.ui.addElement($('last_contact_row'), 'th', {id: 'last_contact_hdr', innerHTML: 'Last Contact'});
	SC.ui.addElement($('last_contact_row'), 'td', {id: 'last_contact', innerHTML: json["lastcontact"], colspan: 2});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'heartbeat_sent_row'});
	SC.ui.addElement($('heartbeat_sent_row'), 'th', {id: 'heartbeat_sent_hdr', innerHTML: 'Heartbeat Sent'});
	SC.ui.addElement($('heartbeat_sent_row'), 'td', {id: 'heartbeat_sent', innerHTML: json["heartbeat_sent"], colspan: 2});

	SC.ui.addElement($('dataTable'), 'tr', {id: 'heartbeat_rcv_row'});
	SC.ui.addElement($('heartbeat_rcv_row'), 'th', {id: 'heartbeat_rcv_hdr', innerHTML: 'Heartbeat Received'});
	SC.ui.addElement($('heartbeat_rcv_row'), 'td', {id: 'heartbeat_rcv', innerHTML: json["heartbeat_rcv"], colspan: 2});

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
		case "ps/powershell/json/Automate": return "(new-object Net.WebClient).DownloadString('"+getLTPoSh()+"') | iex\r\n\r\n# WMI Service check and start\/auto\r\nfunction serviceCheck($service){\r\n\t$svc_info = Get-WmiObject win32_service | where-object {$_.name -eq $service}\r\n\tif ($svc_info.State -eq 'Stopped') { Start-Service $service; $state_check = 'Previously Stopped, starting service now' -f $service }\r\n\telseif ($svc_info.state -eq 'Running') { $state_check = 'Running' -f $service }\r\n\t\r\n\tif ($svc_info.StartMode -eq 'Auto') { $start_check = 'Automatic' }\r\n\telse { $svc_info.ChangeStartMode('Auto'); $start_check = 'Previously set to {0} changed to Auto' -f $svc_info.StartMode }\r\n\t@{'Status' = $state_check; 'Start Mode' = $start_check }\r\n}\r\n\r\n# Check services\r\n$ltservice_check = serviceCheck('LTService')\r\n$ltsvcmon_check = serviceCheck('LTSVCMon')\r\n\r\n# Get ltservice info\r\n$info = Get-LTServiceInfo\r\n$lastsuccess = Get-Date $info.LastSuccessStatus\r\n$lasthbsent = Get-Date $info.HeartbeatLastSent\r\n$lasthbrcv = Get-Date $info.HeartbeatLastReceived\r\n\r\n# Check online and heartbeat statuses\r\n$online_threshold = (Get-Date).AddMinutes(-5)\r\n$heartbeat_threshold = (Get-Date).AddMinutes(-5)\r\n$servers = ($info.'Server Address').Split('|')\r\n$online = $lastsuccess -ge $online_threshold\r\n$heartbeat_rcv = $lasthbrcv -ge $heartbeat_threshold \r\n$heartbeat_snd = $lasthbsent -ge $heartbeat_threshold\r\n$heartbeat = $heartbeat_rcv -or $heartbeat_snd\r\n\r\n# Get server list\r\n$Server = $servers|Select-Object -Expand 'Server' -EA 0\r\n\r\n# Check updates\r\n$update = Try { $results = Update-LTService -WarningVariable updatetest 3>&1 -WarningAction Stop; 'Updated from {1} to {0}' -f (Get-LTServiceInfo).Version,$info.Version } catch { 'No update needed, on {0}' -f (Get-LTServiceInfo).Version }\r\n\r\n# Output diagnostic data in JSON format\r\n$diag = @{\r\n    'id' = $info.id\r\n\t'version' = $info.Version\r\n\t'server_addr' = $servers -join \", \"\r\n\t'online' = $online\r\n\t'heartbeat' = $heartbeat\r\n\t'update' = $update\r\n\t'updatedebug' = $updatetest[0].message\r\n\t'lastcontact'  = $info.LastSuccessStatus\r\n\t'heartbeat_sent' = $info.HeartbeatLastSent\r\n\t'heartbeat_rcv' = $info.HeartbeatLastReceived\r\n\t'svc_ltservice' = $ltservice_check\r\n\t'svc_ltsvcmon' = $ltsvcmon_check\r\n}\r\n$diag | ConvertTo-Json -depth 2";
		
		/*case "sh/linux/text/Processes": return "ps -eo \"%U,%p,%x,%C,%c\"";
		case "sh/linux/text/EventLog": return "echo " + headers.DiagnosticType + " ; dmesg -T | tail -" + getValidEventLogCount();
		case "sh/linux/text/Services": return "echo " + headers.DiagnosticType + " ; ls /etc/init.d";
		case "sh/linux/text/Software": return "echo " + headers.DiagnosticType + " ; dpkg --get-selections";
		
		case "sh/osx/text/Processes": return "ps -eo \"pid,%cpu,command\"";
		case "sh/osx/text/EventLog": return "echo " + headers.DiagnosticType + " ; syslog -C";
		case "sh/osx/text/Services": return "echo " + headers.DiagnosticType + " ; launchctl list";
		case "sh/osx/text/Software": return "echo " + headers.DiagnosticType + " ; ls /Applications";*/
    	default: throw "unknown os";
	}
}

