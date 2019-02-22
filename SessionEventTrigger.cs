using System;
using System.IO;
using System.Collections.Generic;
using System.Text;
using ScreenConnect;
using System.Linq;
using System.Collections;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text.RegularExpressions;
public class SessionEventTriggerAccessor : IDynamicSessionEventTrigger
{
	public Proc GetDeferredActionIfApplicable(SessionEventTriggerEvent sessionEventTriggerEvent)
	{
		if (sessionEventTriggerEvent.SessionEvent.EventType == SessionEventType.Connected && 
			sessionEventTriggerEvent.SessionConnection.ProcessType == ProcessType.Guest) {
				return (Proc)delegate
				{
					var sessionDetails = SessionManagerPool.Demux.GetSessionDetails(sessionEventTriggerEvent.Session.SessionID);
					if (sessionDetails.Session.SessionType == SessionType.Access) {
						var ltposh = ExtensionContext.Current.GetSettingValue("PathToLTPoSh");
						var diag = ExtensionContext.Current.GetSettingValue("PathToDiag");
						var command = "#!ps\n#maxlength=100000\n#timeout=300000\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\necho ''\n(new-object Net.WebClient).DownloadString('"+diag+"') | iex\r\nStart-AutomateDiagnostics -ltposh '"+ltposh+"'";

						SessionManagerPool.Demux.AddSessionEvent(
							sessionEventTriggerEvent.Session.SessionID,
							new SessionEvent
							{
								EventType = SessionEventType.QueuedCommand,
								Host = "AutomateDiagnostics",
								Data = command
							}
						);
					}
				};
		}
		else if (sessionEventTriggerEvent.SessionEvent.EventType == SessionEventType.RanCommand) {
			return (Proc)delegate
				{
					var sessionDetails = SessionManagerPool.Demux.GetSessionDetails(sessionEventTriggerEvent.Session.SessionID);
                    string output = sessionEventTriggerEvent.SessionEvent.Data;
					var data = output.Split(new string[] { "!---BEGIN JSON---!" }, StringSplitOptions.None);
					if (data[1] != "") {
						DiagOutput diag = Deserialize(data[1]);
						string version = diag.version;
						var session = sessionEventTriggerEvent.Session;
						session.CustomPropertyValues[6] = version;
						SessionManagerPool.Demux.UpdateSession("AutomateDiagnostics", session.SessionID, session.Name, session.IsPublic, session.Code, session.CustomPropertyValues);
					}
				};
		}
		return null;
	}
	
	public DiagOutput Deserialize(string json) {
        DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof(DiagOutput));
        using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(json))) {
        	return ser.ReadObject(ms) as DiagOutput;
        }
    }

    private static string FormatMessage(string message) {
        DateTime now = DateTime.Now;
        return string.Format("{0}: {1}", now.ToString(), message);
    }
	public static void WriteLog(string message) {
        try {
            using (StreamWriter streamWriter = new StreamWriter(string.Concat(Environment.ExpandEnvironmentVariables("%windir%"), "\\temp\\AutomateDiagnostics.log"), true)) {
                streamWriter.WriteLine(FormatMessage(message));
            }
        }
        catch {}
    }
}

public class DiagOutput
{
    [DataMember(Name="id", IsRequired=false)]
    public String id;

    [DataMember(Name = "version", IsRequired = false)]
    public String version;

    [DataMember(Name = "server_addr", IsRequired = false)]
    public String server_addr;

    [DataMember(Name = "online", IsRequired = false)]
    public Boolean online;

    [DataMember(Name = "heartbeat", IsRequired = false)]
    public Boolean heartbeat;

    [DataMember(Name = "lastcontact", IsRequired = false)]
    public String lastcontact;

    [DataMember(Name = "heartbeat_sent", IsRequired = false)]
    public String heartbeat_sent;

    [DataMember(Name = "heartbeat_rcv", IsRequired = false)]
    public String heartbeat_rcv;

    [DataMember(Name = "ltposh_loaded", IsRequired = true)]
    public Boolean ltposh_loaded;
}