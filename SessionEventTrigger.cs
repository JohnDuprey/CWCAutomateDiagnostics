using System;
using System.Collections.Generic;
using ScreenConnect;
using System.Linq;

public class SessionEventTriggerAccessor : IDynamicSessionEventTrigger
{
	public Proc GetDeferredActionIfApplicable(SessionEventTriggerEvent sessionEventTriggerEvent)
	{
		if (sessionEventTriggerEvent.SessionEvent.EventType == SessionEventType.Connected && 
			sessionEventTriggerEvent.SessionConnection.ProcessType == ProcessType.Guest) {
				return (Proc)delegate
				{
					var sessionDetails = SessionManagerPool.Demux.GetSessionDetails(sessionEventTriggerEvent.Session.SessionID);

                    var ltposh = ExtensionContext.Current.GetSettingValue("PathToLTPoSh");
                    var command = "#!ps\n#maxlength=100000\n#timeout=90000\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\necho ''\n(new-object Net.WebClient).DownloadString('"+ltposh+"') | iex\r\n\r\n# WMI Service check and start\/auto\r\nfunction serviceCheck($service){\r\n\t$svc_info = Get-WmiObject win32_service | where-object {$_.name -eq $service}\r\n\tif ($svc_info.State -eq 'Stopped') { Start-Service $service; $state_check = 'Previously Stopped, starting service now' -f $service }\r\n\telseif ($svc_info.state -eq 'Running') { $state_check = 'Running' -f $service }\r\n\t\r\n\tif ($svc_info.StartMode -eq 'Auto') { $start_check = 'Automatic' }\r\n\telse { $svc_info.ChangeStartMode('Auto'); $start_check = 'Previously set to {0} changed to Auto' -f $svc_info.StartMode }\r\n\t@{'Status' = $state_check; 'Start Mode' = $start_check }\r\n}\r\n\r\n# Check services\r\n$ltservice_check = serviceCheck('LTService')\r\n$ltsvcmon_check = serviceCheck('LTSVCMon')\r\n\r\n# Get ltservice info\r\n$info = Get-LTServiceInfo\r\n$lastsuccess = Get-Date $info.LastSuccessStatus\r\n$lasthbsent = Get-Date $info.HeartbeatLastSent\r\n$lasthbrcv = Get-Date $info.HeartbeatLastReceived\r\n\r\n# Check online and heartbeat statuses\r\n$online_threshold = (Get-Date).AddMinutes(-5)\r\n$heartbeat_threshold = (Get-Date).AddMinutes(-5)\r\n$servers = ($info.'Server Address').Split('|')\r\n$online = $lastsuccess -ge $online_threshold\r\n$heartbeat_rcv = $lasthbrcv -ge $heartbeat_threshold \r\n$heartbeat_snd = $lasthbsent -ge $heartbeat_threshold\r\n$heartbeat = $heartbeat_rcv -or $heartbeat_snd\r\n\r\n# Get server list\r\n$Server = $servers|Select-Object -Expand 'Server' -EA 0\r\n\r\n# Check updates\r\n$update = Try { $results = Update-LTService -WarningVariable updatetest 3>&1 -WarningAction Stop; $update_text = 'Updated from {1} to {0}' -f (Get-LTServiceInfo).Version,$info.Version } catch { $update_text = 'No update needed, on {0}' -f (Get-LTServiceInfo).Version }\r\n\r\n# Output diagnostic data in JSON format\r\n$diag = @{\r\n    'id' = $info.id\r\n\t'version' = $info.Version\r\n\t'server_addr' = $servers -join \", \"\r\n\t'online' = $online\r\n\t'heartbeat' = $heartbeat\r\n\t'update' = $update_text\r\n\t'updatedebug' = $updatetest[0].message\r\n\t'lastcontact'  = $info.LastSuccessStatus\r\n\t'heartbeat_sent' = $info.HeartbeatLastSent\r\n\t'heartbeat_rcv' = $info.HeartbeatLastReceived\r\n\t'svc_ltservice' = $ltservice_check\r\n\t'svc_ltsvcmon' = $ltsvcmon_check\r\n}\r\n$diag | ConvertTo-Json -depth 2";

					SessionManagerPool.Demux.AddSessionEvent(
						sessionEventTriggerEvent.Session.SessionID,
						new SessionEvent
						{
							EventType = SessionEventType.QueuedCommand,
							Host = "AutomateDiagnostics",
							Data = command
						}
					);
				};
		}
		return null;
	}
}