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
                    var diag = "https://raw.githubusercontent.com/johnduprey/CWCAutomateDiagnostics/master/AutomateDiagnostics.ps1";
					var command = "#!ps\n#maxlength=100000\n#timeout=90000\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\necho ''\n(new-object Net.WebClient).DownloadString('"+diag+"') | iex\r\nStart-AutomateDiagnostics -ltposh '"+ltposh+"'";

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