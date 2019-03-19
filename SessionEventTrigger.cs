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
using System.Reflection;
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
						var linuxdiag = ExtensionContext.Current.GetSettingValue("PathToMacLinuxDiag");
						var server = ExtensionContext.Current.GetSettingValue("AutomateHostname");
						var os = sessionDetails.Session.GuestInfo.OperatingSystemName;
						//var_dump(sessionDetails);
						//var_dump(sessionDetails.Session.GuestInfo);
						var command = "";

						if ( os.StartsWith("Windows") ) { 
							command = "#!ps\n#maxlength=100000\n#timeout=600000\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\necho ''\n$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12}; [System.Net.ServicePointManager]::ServerCertificateValidationCallback = {$true}; Try {(new-object Net.WebClient).DownloadString('"+ diag +"') | iex; Start-AutomateDiagnostics -ltposh '"+ ltposh +"' -automate_server '"+server+"'} Catch { $_.Exception.Message; Write-Host '!---BEGIN JSON---!'; Write-Host '{\"version\": \"Error loading AutomateDiagnostics\"}' }";
						}
						else if ( os.StartsWith("Mac") || os.StartsWith("Linux") ) {
							command = "#!sh\n#maxlength=100000\n#timeout=600000\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\n echo "+os+"; url="+linuxdiag+"; CURL=$(command -v curl); WGET=$(command -v wget); if [ ! -z $CURL ]; then echo $url; echo $($CURL -s $url | python); else echo $($WGET -q -O - --no-check-certificate $url | python); fi";
						}
						else { command = "echo No OS Detected, try running the diagnostic again"; }
						
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
						var session = sessionEventTriggerEvent.Session;
						if (diag.version != null) {
							session.CustomPropertyValues[6] = diag.version;
						}
						if (diag.id != null) {
							session.CustomPropertyValues[5] = diag.id;
						}
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
	public static void var_dump(object obj)   
	{   
			WriteLog(String.Format("{0,-18} {1}", "Name", "Value"));   
			string ln = @"-----------------------------------------------------------------";   
			WriteLog(ln);   
				
			Type t = obj.GetType();   
			PropertyInfo[] props = t.GetProperties();   
				
			for(int i = 0; i < props.Length; i++)   
			{   
					try   
					{   
							WriteLog(String.Format("{0,-18} {1}",   
								props[i].Name, props[i].GetValue(obj, null)));   
					}   
					catch(Exception e)   
					{   
							//Console.WriteLine(e);   
					}   
			}   
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