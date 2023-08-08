using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using ScreenConnect;

public class
SessionEventTriggerAccessor
: IAsyncDynamicEventTrigger<SessionEventTriggerEvent>
{
    public async Task
    ProcessEventAsync(SessionEventTriggerEvent sessionEventTriggerEvent)
    {
        if (sessionEventTriggerEvent.SessionEvent.EventType == SessionEventType.Connected
            && sessionEventTriggerEvent.SessionConnection.ProcessType == ProcessType.Guest
            && ExtensionContext.Current.GetSettingValue("MaintenanceMode") == "0"
            && sessionEventTriggerEvent.Session.ActiveConnections.Where(_ => _.ProcessType == ProcessType.Host).Count() == 0
        )
            await RunDiagnostics(sessionEventTriggerEvent, ExtensionContext.Current);
        else if (sessionEventTriggerEvent.SessionEvent.EventType == SessionEventType.RanCommand && IsDiagnosticContent(sessionEventTriggerEvent.SessionEvent.Data))
        {
            try
            {
                var sessionDetails = await SessionManagerPool.Demux.GetSessionDetailsAsync(sessionEventTriggerEvent.Session.SessionID);
                string output = sessionEventTriggerEvent.SessionEvent.Data;

                if (IsDiagResult(output))
                {
                    var data = output.Split(new string[] { "!---BEGIN JSON---!" }, StringSplitOptions.None);
                    if (data[1] != "")
                    {
                        DiagOutput diag = Deserialize(data[1]);
                        var newCustomProperties = sessionEventTriggerEvent.Session.CustomPropertyValues.ToArray();

                        if (diag.version != null)
                            newCustomProperties[Int32.Parse(ExtensionContext.Current.GetSettingValue("AgentVersionCustomProperty")) - 1] = diag.version;

                        if (diag.id != null)
                            newCustomProperties[Int32.Parse(ExtensionContext.Current.GetSettingValue("AgentIDCustomProperty")) - 1] = diag.id;

                        await SessionManagerPool.Demux.UpdateSessionAsync(
                            "AutomateDiagnostics",
                            sessionEventTriggerEvent.Session.SessionID,
                            ExtensionContext.Current.GetSettingValue("SetUseMachineName") == "1" ? "": sessionEventTriggerEvent.Session.Name,
                            sessionEventTriggerEvent.Session.IsPublic,
                            sessionEventTriggerEvent.Session.Code,
                            newCustomProperties
                        );
                    }
                }
                else if (IsRepairResult(output))
                    await RunDiagnostics(sessionEventTriggerEvent, ExtensionContext.Current);
            }
            catch (Exception e)
            {
                WriteLog(e.Message);
            }
        }
    }

    public DiagOutput Deserialize(string json)
    {
        DataContractJsonSerializer ser = new DataContractJsonSerializer(typeof (DiagOutput));
        using (var ms = new MemoryStream(Encoding.UTF8.GetBytes(json)))
        {
            return ser.ReadObject(ms) as DiagOutput;
        }
    }

    // 2023.01.16 -- Joe McCall | Imported the newer ASync method from DEV branch
    // 2023.01.19 -- swlinak | changed method prototype to return Task, can cause compiler issues if attempting to return void
    private async Task RunDiagnostics(SessionEventTriggerEvent sessionEventTriggerEvent, ExtensionContext extensionContext)
    {
        var sessionDetails = await SessionManagerPool.Demux.GetSessionDetailsAsync(sessionEventTriggerEvent.Session.SessionID);
        if (sessionDetails.Session.SessionType == SessionType.Access)
        {
            var ltposh = extensionContext.GetSettingValue("PathToLTPoSh");
            var diag = extensionContext.GetSettingValue("PathToDiag");
            var linuxdiag = extensionContext.GetSettingValue("PathToLinuxDiag");
            var macdiag = extensionContext.GetSettingValue("PathToMacDiag");
            var server = extensionContext.GetSettingValue("AutomateHostname");
            var os = sessionDetails.Session.GuestInfo.OperatingSystemName;
            var timeout = extensionContext.GetSettingValue("Timeout");
            var command = "";

            // 2023.01.16 -- Joe McCall | Expanded with distinct option for MacOSX and Linux
            if (os.Contains("Windows"))
            {
                command =
                    "#!ps\n#maxlength=100000\n#timeout=" +
                    timeout +
                    "\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\necho ''\n$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12}; Try {(new-object Net.WebClient).DownloadString('" +
                    diag +
                    "') | iex; Start-AutomateDiagnostics -ltposh '" +
                    ltposh +
                    "' -automate_server '" +
                    server +
                    "'} Catch { $_.Exception.Message; Write-Output '!---BEGIN JSON---!'; Write-Output '{\"version\": \"Error loading AutomateDiagnostics\"}' }";
            }
            else if (os.Contains("Mac"))
            {
                // 2023.01.16 -- Joe McCall | Calling the AutomateDiagnostics.sh sourced from here: https://github.com/noaht8um/CWCAutomateDiagnostics/
                command =
                    "#!sh\n#maxlength=100000\n#timeout=" +
                    timeout +
                    "\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\nurl=" +
                    macdiag +
                    "; CURL=$(command -v curl); WGET=$(command -v wget); if [ ! -z $CURL ]; then echo $($CURL -s $url | sh); else echo $($WGET -q -O - --no-check-certificate $url | sh); fi";
            }
            else if (os.Contains("Linux"))
            {
                command =
                    "#!sh\n#maxlength=100000\n#timeout=" +
                    timeout +
                    "\necho 'DIAGNOSTIC-RESPONSE/1'\necho 'DiagnosticType: Automate'\necho 'ContentType: json'\nurl=" +
                    linuxdiag +
                    "; CURL=$(command -v curl); WGET=$(command -v wget); if [ ! -z $CURL ]; then echo $($CURL -s $url | python); else echo $($WGET -q -O - --no-check-certificate $url | python); fi";
            }
            else
            {
                command =
                    "@echo off\necho No OS Detected, try running the diagnostic again";
            }

            await SessionManagerPool.Demux.AddSessionEventAsync(
                sessionEventTriggerEvent.Session.SessionID,
                SessionEventType.QueuedCommand,
                SessionEventAttributes.NeedsProcessing,
                "AutomateDiagnostics",
                command
            );
        }
    }

    private bool IsDiagnosticContent(string eventData)
    {
        if (eventData.StartsWith("DIAGNOSTIC-RESPONSE/1") || eventData.StartsWith("\ufeffDIAGNOSTIC-RESPONSE/1"))
            return true;
        else
            return false;
    }

    private bool IsRepairResult(string eventData)
    {
        if (eventData.Contains("DiagnosticType: ReinstallAutomate") ||eventData.Contains("DiagnosticType: RestartAutomate"))
            return true;
        else
            return false;
    }

    private bool IsDiagResult(string eventData)
    {
        var data =
            eventData
                .Split(new string[] { "!---BEGIN JSON---!" },
                StringSplitOptions.None);
        if (data[1] != "")
        {
            if (data[0].Contains("DiagnosticType: Automate"))
            {
                return true;
            }
            else
            {
                return false;
            }
        }
        else
        {
            return false;
        }
    }

    private static string FormatMessage(string message)
    {
        DateTime now = DateTime.Now;
        return string.Format("{0}: {1}", now.ToString(), message);
    }

    public static void WriteLog(string message)
    {
        try
        {
            using (
                StreamWriter streamWriter =
                    new StreamWriter(string
                            .Concat(Environment
                                .ExpandEnvironmentVariables("%windir%"),
                            "\\temp\\AutomateDiagnostics.log"),
                        true)
            )
            {
                streamWriter.WriteLine(FormatMessage(message));
            }
        }
        catch
        {
        }
    }

    public static void var_dump(object obj)
    {
        WriteLog(String.Format("{0,-18} {1}", "Name", "Value"));
        string ln =
            @"-----------------------------------------------------------------";
        WriteLog (ln);

        Type t = obj.GetType();
        PropertyInfo[] props = t.GetProperties();

        for (int i = 0; i < props.Length; i++)
        {
            try
            {
                WriteLog(String
                    .Format("{0,-18} {1}",
                    props[i].Name,
                    props[i].GetValue(obj, null)));
            }
            catch (Exception e)
            {
                //Console.WriteLine(e);
            }
        }
    }
}

public class DiagOutput
{
    [DataMember(Name = "id", IsRequired = false)]
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
