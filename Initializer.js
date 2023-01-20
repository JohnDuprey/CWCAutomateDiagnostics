SC.event.addGlobalHandler(SC.event.PreRender, function (eventArgs) {
  if (SC.context.pageType == "HostPage") {
    SC.util.includeStyleSheet(
      extensionContext.baseUrl + "DiagnosticsNewStyle.css"
    );
  }
});

function getLTPoSh() {
  return extensionContext.settingValues.PathToLTPoSh;
}
function getAutomateDiagnosticsURL() {
  return extensionContext.settingValues.PathToDiag;
}
function getLinuxDiagnosticsURL() {
  return extensionContext.settingValues.PathToLinuxDiag;
}
function getMacDiagnosticsURL() {
  return extensionContext.settingValues.PathToMacDiag;
}
function getLTServer() {
  return extensionContext.settingValues.AutomateHostname;
}
function getInstallerToken() {
  return extensionContext.settingValues.InstallerToken;
}
function getAgentVersionProp() {
  return extensionContext.settingValues.AgentVersionCustomProperty;
}
function getTimeout() {
  return extensionContext.settingValues.Timeout;
}
function getVerbose() {
  if (extensionContext.settingValues.Verbose == "1") {
    return "-Verbose";
  } else {
    return "";
  }
}

SC.event.addGlobalHandler(SC.event.QueryCommandButtons, function (eventArgs) {
  switch (eventArgs.area) {
    case "HostDetailTabList":
      eventArgs.buttonDefinitions.push({
        commandName: "Select",
        commandArgument: "Automate",
        text: SC.res["Diagnostics.Automate.Label"],
        imageUrl: extensionContext.baseUrl + "Automate.png",
      });
      break;
    case "HostDetailPopoutPanel":
      eventArgs.buttonDefinitions.push({
        commandName: "GetInfoPer",
        commandArgument: "Automate",
        text: SC.res["Diagnostics.Automate.Button"],
      });
      break;
    case "AutomateButtons":
      eventArgs.buttonDefinitions.push({
        commandName: "GetInfo",
        commandArgument: "Automate",
        text: SC.res["Diagnostics.Automate.Button"],
      });
      break;
    case "ReinstallButton":
      eventArgs.buttonDefinitions.push({
        commandName: "ReinstallAutomate",
        commandArgument: "Automate",
        text: SC.res["Diagnostics.Automate.ReinstallButton"],
      });
      break;
    case "RestartButton":
      eventArgs.buttonDefinitions.push({
        commandName: "RestartAutomate",
        commandArgument: "Automate",
        text: SC.res["Diagnostics.Automate.RestartButton"],
      });
      break;
  }
});

SC.event.addGlobalHandler(SC.event.InitializeTab, function (eventArgs) {
  if (isMyTab(eventArgs.tabName)) {
    SC.ui.addElement(eventArgs.container, "DIV", { id: "diagTopContainer" });
    var diagButton = SC.ui.addElement($("diagTopContainer"), "div", {
      id: "diagButtonContainer",
      className: "DiagActions",
    });
    SC.command.queryAndAddCommandButtons(
      diagButton,
      eventArgs.tabName + "Buttons"
    );
    SC.ui.addElement($("diagTopContainer"), "DIV", {
      id: "lastUpdateContainer",
    });
    SC.ui.addElement(eventArgs.container, "DIV", {
      id: "detailsPanel",
      className: "CollapsiblePanel",
    });
    SC.ui.addElement($("detailsPanel"), "DIV", {
      id: "dataContainer",
      className: "Header",
    });
    SC.ui.addElement($("detailsPanel"), "TABLE", { id: "dataTable" });
    SC.ui.addElement(eventArgs.container, "DIV", {
      id: "repairOptions",
      className: "CollapsiblePanel",
    });
    SC.ui.addElement(eventArgs.container, "DIV", {
      id: "lterrors",
      className: "CollapsiblePanel",
    });
  }
});

SC.event.addGlobalHandler(SC.event.RefreshTab, function (eventArgs) {
  if (isMyTab(eventArgs.tabName)) {
    SC.ui.clear($("dataContainer"));
    SC.ui.clear($("lastUpdateContainer"));
    SC.ui.clear($("dataTable"));
    SC.ui.clear($("repairOptions"));
    SC.ui.clear($("lterrors"));

    SC.ui.findDescendent(eventArgs.container, function (e) {
      return e._commandName == "GetInfo";
    })._commandArgument = {
      type: eventArgs.tabName,
      operatingSystemName: eventArgs.session.GuestOperatingSystemName,
    };

    displayAutomateDiagInfo(
      getLatestDiagnosticEvent(eventArgs.sessionDetails, eventArgs.tabName),
      eventArgs.sessionDetails.BaseTime
    );
  }
});

SC.event.addGlobalHandler(SC.event.ExecuteCommand, function (eventArgs) {
  switch (eventArgs.commandName) {
    case "GetInfo":
      sendCommand(eventArgs);
      break;
    case "ReinstallAutomate":
      showReinstallPrompt();
      break;
    case "RestartAutomate":
      sendCommand({
        commandArgument: {
          type: "RestartAutomate",
          operatingSystemName: "Windows",
        },
      });
      break;
    case "GetInfoPer":
      var checkedOrSelectedRows = Array.prototype.filter.call(
        ($("detailTable") || $(".DetailTable")).rows,
        function (r) {
          return SC.ui.isChecked(r) || SC.ui.isSelected(r);
        }
      );
      var checkedOrSelectedSessions = Array.prototype.map.call(
        checkedOrSelectedRows,
        function (r) {
          return r._dataItem;
        }
      );
      var sessionType =
        checkedOrSelectedSessions[0].SessionType === undefined
          ? SC.types.SessionTypes.Access
          : checkedOrSelectedSessions[0].SessionType;
      var windowsSessionIDs = Array.prototype.map
        .call(checkedOrSelectedSessions, function (s) {
          if (s.GuestOperatingSystemName.includes("Windows"))
            return s.SessionID;
        })
        .filter(function (s) {
          return s !== undefined;
        });
      var linuxMacSessionIDs = Array.prototype.map
        .call(checkedOrSelectedSessions, function (s) {
          if (!s.GuestOperatingSystemName.includes("Windows"))
            return s.SessionID;
        })
        .filter(function (s) {
          return s !== undefined;
        });
      window.addEventToSessions(
        window.getSessionGroupUrlPart()[0],
        SC.types.SessionType.Access,
        windowsSessionIDs,
        SC.types.SessionEventType.QueuedCommand,
        null,
        getAutomateInputCommand("Automate", "Windows"),
        false,
        false,
        true
      );
      window.addEventToSessions(
        window.getSessionGroupUrlPart()[0],
        SC.types.SessionType.Access,
        linuxMacSessionIDs,
        SC.types.SessionEventType.QueuedCommand,
        null,
        getAutomateInputCommand("Automate", "Linux"),
        false,
        false,
        true
      );
      break;
  }
});

SC.event.addGlobalHandler(SC.event.PreRender, function (eventArgs) {
  if (typeof extensionContext !== "undefined") {
    if (extensionContext.settingValues.CreateVersionSessionGroup == 1) {
      var versionProperty = getAgentVersionProp();
      SC.service.NotifyCreatedVersionSessionGroup();
      SC.service.SetVersionCustomProperties();
      SC.service.GetSessionGroups(function (sessionGroups) {
        for (
          var sessionTypesAsString = ["Sessions", "Meetings", "Machines"],
            sessionType = 0;
          sessionType < sessionTypesAsString.length;
          sessionType++
        ) {
          var name =
            "All " + sessionTypesAsString[sessionType] + " by CWA Version";

          if (
            !sessionGroups.find(function (session) {
              return session.Name === name;
            })
          ) {
            sessionGroups.push({
              Name: name,
              SessionFilter: "NOT CustomProperty" + versionProperty + " = ''",
              SessionType: sessionType,
              SubgroupExpressions: "CustomProperty" + versionProperty,
            });
          }
        }

        SC.service.SaveSessionGroups(sessionGroups);
      });
    }
  }
});

function showReinstallPrompt() {
  var locationId = $("#locationidval").innerHTML;
  var installertoken = getInstallerToken();
  SC.dialog.showModalDialogRaw(
    "JoinSessionWithOptions",
    [
      SC.dialog.createTitlePanel("Reinstall Automate Agent"),
      SC.dialog.createContentPanel([
        $dl(
          [
            $dt("Location ID"),
            $dd(
              (txtlocationid = $input({
                id: "locationidreinstall",
                type: "text",
                value: locationId ? locationId : 1,
              }))
            ),
          ],
          [
            $dt("Installer Token"),
            $dd(
              (txtlocationid = $input({
                id: "installertoken",
                type: "text",
                value: installertoken,
              }))
            ),
          ]
        ),
      ]),
      (buttonPanel = SC.dialog.createButtonPanel("Reinstall")),
    ],
    function (eventArgs, dialog) {
      SC.dialog.hideModalDialog();
      sendCommand({
        commandArgument: {
          type: "ReinstallAutomate",
          operatingSystemName: "Windows",
        },
      });
    }
  );
}

function sendCommand(eventArgs) {
  window.addEventToSessions(
    window.getSessionGroupUrlPart()[0],
    SC.types.SessionType.Access,
    [window.getSessionUrlPart()],
    SC.types.SessionEventType.QueuedCommand,
    null,
    getAutomateInputCommand(
      eventArgs.commandArgument.type,
      eventArgs.commandArgument.operatingSystemName
    ),
    false,
    false,
    true
  );
}

function getAutomateInputCommand(diagnosticType, operatingSystem) {
  var headers = getHeaders(operatingSystem);
  headers.DiagnosticType = diagnosticType;
  var commandText = getAutomateCommandText(headers);
  var timeout = getTimeout();
  var emptyLinePrefix = "";

  if (headers.Processor == "sh") emptyLinePrefix = "echo ";
  else {
    emptyLinePrefix = 'echo ""';
  }

  return (
    "#!" +
    headers.shaBang +
    "\n" +
    "#maxlength=10000000" +
    "\n" +
    "#timeout=" +
    timeout +
    "\n" +
    headers.modifier +
    "DIAGNOSTIC-RESPONSE/1" +
    headers.delimiter +
    "\n" +
    headers.modifier +
    "DiagnosticType: " +
    headers.DiagnosticType +
    headers.delimiter +
    "\n" +
    headers.modifier +
    "ContentType: " +
    headers.ContentType +
    headers.delimiter +
    "\n" +
    emptyLinePrefix +
    "\n" +
    commandText
  );
}

function getHeaders(operatingSystem) {
  //2023.01.16 -- Joe McCall | Windows matching was not working reliably, because Windows OS does not start with Windows on newer OS (Microsoft Windows 1x)
  if (operatingSystem.match("Windows")) {
    return {
      Processor: "ps",
      Interface: "powershell",
      ContentType: "json",
      shaBang: "ps",
      modifier: 'echo "',
      delimiter: '"',
      OperatingSystem: "Windows",
    };
  }
  //2023.01.16 -- Joe McCall | Split Mac OS and Linux
  else if (operatingSystem.startsWith("Mac OS")) {
    return {
      Processor: "sh",
      Interface: "bash",
      ContentType: "json",
      shaBang: "sh",
      modifier: "echo ",
      delimiter: "",
      OperatingSystem: "Mac",
    };
  } else {
    return {
      Processor: "sh",
      Interface: "bash",
      ContentType: "json",
      shaBang: "sh",
      modifier: "echo ",
      delimiter: "",
      OperatingSystem: "Linux",
    };
  }
}

function isMyTab(tabName) {
  switch (tabName) {
    case "Automate":
      return true;
    default:
      return false;
  }
}

function isDiagnosticContent(eventData) {
  return eventData.startsWith("DIAGNOSTIC-RESPONSE/1") ||
    (eventData.startsWith("\ufeffDIAGNOSTIC-RESPONSE/1") &&
      eventData.match("/!---BEGIN JSON---!/g"))
    ? true
    : false;
}

function getLatestDiagnosticEvent(sessionDetails, diagnosticEventType) {
  // 2023.01.16 -- Joe McCall | Parsing of sessionDetails.Connections fails; sessionDetails.Events requires no additional parsing.
  return sessionDetails.Events.filter(function (e) {
    return (
      e.EventType === SC.types.SessionEventType.RanCommand &&
      isDiagnosticContent(e.Data) &&
      parseDataHeaders(e.Data).DiagnosticType.trim() == diagnosticEventType
    );
  }).sort(function (x, y) {
    return x.Time - y.Time;
  })[0];
}

function parseDataHeaders(eventData) {
  var currentIndex = 0;
  var headers = {};
  var isStatusLine = true;

  while (true) {
    var nextNewLineIndex = eventData.indexOf("\n", currentIndex);

    if (isStatusLine) {
      isStatusLine = false;
    } else if (nextNewLineIndex == currentIndex + 2 || nextNewLineIndex < 0) {
      break;
    } else {
      var lineParts = eventData
        .substring(currentIndex, nextNewLineIndex)
        .split(": ");
      headers[lineParts[0]] = lineParts[1];
    }
    currentIndex = nextNewLineIndex + 1;
  }
  return headers;
}

function displayAutomateDiagInfo(latestDiagnosticEvent, baseTime) {
  try {
    var headers = parseDataHeaders(latestDiagnosticEvent.Data);
    var output = latestDiagnosticEvent.Data;
    var data = output.split("!---BEGIN JSON---!");
    //console.log(data[1]);
    displayDataJson(parseJson(data[1]));
    $("lastUpdateContainer").innerHTML =
      SC.res["Diagnostics.LastUpdateField.Label"] +
      new Date(latestDiagnosticEvent.Time + baseTime).toLocaleString();
  } catch (e) {
    console.log("No diagnostic data to display");
    // 2023.01.16 -- Joe McCall | Uncomment for additional debugging.
    // console.log(e.message);
  }
}

function extractJSON(str) {
  var firstOpen, firstClose, candidate;
  firstOpen = str.indexOf("{", firstOpen + 1);
  do {
    firstClose = str.lastIndexOf("}");
    if (firstClose <= firstOpen) {
      return null;
    }
    do {
      candidate = str.substring(firstOpen, firstClose + 1);
      try {
        var res = JSON.parse(candidate);
        //console.log('...found');
        return res;
      } catch (e) {}
      firstClose = str.substr(0, firstClose).lastIndexOf("}");
    } while (firstClose > firstOpen);
    firstOpen = str.indexOf("{", firstOpen + 1);
  } while (firstOpen != -1);
}

function parseJson(eventData) {
  var json = extractJSON(eventData);
  //console.log(json);
  return json;
}

function displayDataJson(json) {
  SC.ui.addElement($("dataContainer"), "h3", {
    id: "tableDetails",
    innerHTML: "Details",
  });

  console.log(json);

  if ("server_addr" in json) {
    if (!/Error/i.test(json["server_addr"]) && json["server_addr"] != null) {
      var server_status = "<span class='success'>✓</span>";
    } else {
      var server_status = "<span class='failed'>✗</span>";
    }
    if (json["server_addr"] != null) {
      server = json["server_addr"];
    } else {
      server = "No Agent Installed";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "server_row" });
    SC.ui.addElement($("server_row"), "th", {
      id: "server_hdr",
      innerHTML: "Server Check",
    });
    SC.ui.addElement($("server_row"), "td", {
      id: "server",
      innerHTML: server_status + " " + server,
      colspan: 2,
    });
  }

  if ("id" in json) {
    if (json["id"] > 0) {
      var agentid_status = "<span class='success'>✓</span>";
    } else {
      var agentid_status = "<span class='failed'>✗</span>";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "agent_id_row" });
    SC.ui.addElement($("agent_id_row"), "th", {
      id: "agent_id_hdr",
      innerHTML: "Agent ID",
    });
    SC.ui.addElement($("agent_id_row"), "td", {
      id: "agent_id",
      innerHTML: agentid_status + " " + json["id"],
    });
  }

  if ("locationid" in json) {
    if (json["locationid"] > 0) {
      var locationid_status = "<span class='success'>✓</span>";
    } else {
      var locationid_status = "<span class='failed'>✗</span>";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "locationid_row" });
    SC.ui.addElement($("locationid_row"), "th", {
      id: "locationid_hdr",
      innerHTML: "Location ID",
    });
    SC.ui.addElement($("locationid_row"), "td", {
      id: "locationid",
      innerHTML:
        locationid_status +
        " <span id='locationidval'>" +
        json["locationid"] +
        "</span>",
    });
  }

  if ("update" in json) {
    if (!/Error/i.test(json["update"])) {
      var update_status = "<span class='success'>✓</span>";
    } else {
      var update_status = "<span class='failed'>✗</span>";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "update_row" });
    SC.ui.addElement($("update_row"), "th", {
      id: "agent_id_hdr",
      innerHTML: "Update Check",
    });
    SC.ui.addElement($("update_row"), "td", {
      id: "agent_id",
      innerHTML: update_status + " " + json["update"],
      colspan: 2,
    });
  }

  if ("online" in json) {
    var online_status = json["online"]
      ? "<span class='success'>✓</span>"
      : "<span class='failed'>✗</span>";
    SC.ui.addElement($("dataTable"), "tr", { id: "status_row" });
    SC.ui.addElement($("status_row"), "th", {
      id: "status_hdr",
      innerHTML: "Checkin Health",
    });
    SC.ui.addElement($("status_row"), "td", {
      id: "status",
      innerHTML: online_status + " " + json["lastcontact"],
    });
  }

  if ("heartbeat" in json) {
    var heartbeat_status = json["heartbeat"]
      ? "<span class='success'>✓</span>"
      : "<span class='failed'>✗</span>";
    SC.ui.addElement($("dataTable"), "tr", { id: "status_row2" });
    SC.ui.addElement($("status_row2"), "th", {
      id: "status_hdr2",
      innerHTML: "Heartbeat Health",
    });
    SC.ui.addElement($("status_row2"), "td", {
      id: "status2",
      innerHTML: heartbeat_status + " " + json["heartbeat_sent"],
    });
  }

  if ("svc_ltservice" in json) {
    if (json["svc_ltservice"]["Status"] != "Not Detected") {
      var ltservice_txt =
        json["svc_ltservice"]["Status"] +
        " | " +
        json["svc_ltservice"]["Start Mode"] +
        " | " +
        json["svc_ltservice"]["User"];
    } else {
      var ltservice_txt = json["svc_ltservice"]["Status"];
    }
    if (
      json["svc_ltservice"]["Status"] == "Running" &&
      json["svc_ltservice"]["Start Mode"] == "Auto"
    ) {
      var ltservice_status = "<span class='success'>✓</span>";
    } else {
      var ltservice_status = "<span class='failed'>✗</span>";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "ltsvc_row" });
    SC.ui.addElement($("ltsvc_row"), "th", {
      id: "agent_id_hdr",
      innerHTML: "SVC - LTService",
    });
    SC.ui.addElement($("ltsvc_row"), "td", {
      id: "ltsvc",
      innerHTML: ltservice_status + " " + ltservice_txt,
    });
  }

  if ("svc_ltsvcmon" in json) {
    if (json["svc_ltsvcmon"]["Status"] != "Not Detected") {
      var ltsvcmon_txt =
        json["svc_ltsvcmon"]["Status"] +
        " | " +
        json["svc_ltsvcmon"]["Start Mode"] +
        " | " +
        json["svc_ltsvcmon"]["User"];
    } else {
      var ltsvcmon_txt = json["svc_ltsvcmon"]["Status"];
    }
    if (
      json["svc_ltsvcmon"]["Status"] == "Running" &&
      json["svc_ltsvcmon"]["Start Mode"] == "Auto"
    ) {
      var ltsvcmon_status = "<span class='success'>✓</span>";
    } else {
      var ltsvcmon_status = "<span class='failed'>✗</span>";
    }
    SC.ui.addElement($("dataTable"), "tr", { id: "ltsvcmon_row" });
    SC.ui.addElement($("ltsvcmon_row"), "th", {
      id: "agent_id_hdr",
      innerHTML: "SVC - LTSVCMon",
    });
    SC.ui.addElement($("ltsvcmon_row"), "td", {
      id: "ltsvc",
      innerHTML: ltsvcmon_status + " " + ltsvcmon_txt,
    });
  }

  if ("ltposh_loaded" in json) {
    SC.ui.addElement($("dataTable"), "tr", { id: "ltposh_row" });
    SC.ui.addElement($("ltposh_row"), "th", {
      id: "ltposh_hdr",
      innerHTML: "LTPosh Loaded",
    });
    SC.ui.addElement($("ltposh_row"), "td", {
      id: "ltposh",
      innerHTML: json["ltposh_loaded"]
        ? "<span class='success'>✓</span> PowerShell Module Loaded"
        : "<span class='failed'>✗</span> Failed to load PowerShell Module",
      colspan: 2,
    });
  }

  if ("repair" in json) {
    SC.ui.addElement($("dataTable"), "tr", { id: "repair_row" });
    SC.ui.addElement($("repair_row"), "th", {
      id: "repair_hdr",
      innerHTML: "Recommended Repair",
    });
    SC.ui.addElement($("repair_row"), "td", {
      id: "repair_val",
      innerHTML: json["repair"],
      colspan: 2,
    });
  }

  SC.ui.addElement($("repairOptions"), "DIV", {
    id: "repairDiv",
    innerHTML: '<h3 id="repair_hdr">Repair Options</h3>',
    className: "Header",
  });
  var repairCol1 = SC.ui.addElement($("repairOptions"), "div", {
    id: "restartOption",
    className: "DiagActions",
  });
  var repairCol2 = SC.ui.addElement($("repairOptions"), "div", {
    id: "reinstallOption",
    className: "DiagActions",
  });
  SC.command.queryAndAddCommandButtons(repairCol1, "RestartButton");
  SC.command.queryAndAddCommandButtons(repairCol2, "ReinstallButton");

  SC.ui.addElement($("repairOptions"), "DIV", {
    id: "lterrorsDiv",
    innerHTML: '<h3 id="lterrors_hdr">Agent Log</h3>',
    className: "Header",
  });
  if ("lterrors" in json && json["lterrors"] != "") {
    SC.ui.addElement($("lterrors"), "pre", {
      id: "lterrors_file",
      innerHTML: atob(json["lterrors"]),
    });
  } else {
    SC.ui.addElement($("lterrors"), "pre", {
      id: "lterrors_file",
      innerHTML: "Click 'Run CWA Diagnostic' to pull in the latest log file.",
    });
  }
}

function isUsingInternetExplorerOrEdge() {
  var ua = window.navigator.userAgent;
  var msie = ua.indexOf("Trident");

  if (ua.indexOf("Trident") > 0 || ua.indexOf("Edge") > 0) return true;
  else return false;
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
    return Math.abs(Math.round(elapsed / 1000)) + " seconds ago";
  else if (elapsed < msPerHour)
    return Math.round(elapsed / msPerMinute) + " minutes ago";
  else if (elapsed < msPerDay)
    return Math.round(elapsed / msPerHour) + " hours ago";
  else if (elapsed < msPerMonth)
    return "approximately " + Math.round(elapsed / msPerDay) + " days ago";
  else if (elapsed < msPerYear)
    return "approximately " + Math.round(elapsed / msPerMonth) + " months ago";
  else return "approximately " + Math.round(elapsed / msPerYear) + " years ago";
}

// 2023.01.16 -- Joe McCall | Expanded cases and variables to add OS check so Mac and Linux commands are distinct (sh or python)
function getAutomateCommandText(headers) {
  switch (
    headers.Processor +
    "/" +
    headers.OperatingSystem +
    "/" +
    headers.Interface +
    "/" +
    headers.ContentType +
    "/" +
    headers.DiagnosticType
  ) {
    case "ps/Windows/powershell/json/Automate":
      return (
        "$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12}; Try { (new-object Net.WebClient).DownloadString('" +
        getAutomateDiagnosticsURL() +
        "') | iex; Start-AutomateDiagnostics -ltposh '" +
        getLTPoSh() +
        "' -include_lterrors -automate_server '" +
        getLTServer() +
        "' " +
        getVerbose() +
        "} Catch { $_.Exception.Message; Write-Output '!---BEGIN JSON---!'; Write-Output '{\"version\": \"Error loading AutomateDiagnostics\"}' }"
      );
    case "ps/Windows/powershell/json/RestartAutomate":
      return (
        "$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12}; (new-object Net.WebClient).DownloadString('" +
        getLTPoSh() +
        "') | iex; Restart-LTService"
      );
    case "ps/Windows/powershell/json/ReinstallAutomate":
      var txtlocationid = $("#locationidreinstall").value;
      var txtinstallertoken = $("#installertoken").value;
      if (isNaN(txtlocationid)) {
        txtlocationid = "1";
      }
      return (
        "$WarningPreference='SilentlyContinue'; IF([Net.SecurityProtocolType]::Tls) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls}; IF([Net.SecurityProtocolType]::Tls11) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls11}; IF([Net.SecurityProtocolType]::Tls12) {[Net.ServicePointManager]::SecurityProtocol=[Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12};(new-object Net.WebClient).DownloadString('" +
        getLTPoSh() +
        "') | iex; Reinstall-LTService -SkipDotNet -Server https://" +
        getLTServer() +
        " -LocationID " +
        txtlocationid +
        " -InstallerToken " +
        txtinstallertoken
      );
      return;
    case "sh/Linux/bash/json/Automate":
      return (
        "url=" +
        getLinuxDiagnosticsURL() +
        "; CURL=$(command -v curl); WGET=$(command -v wget); if [ ! -z $CURL ]; then echo $($CURL -s $url | python - -e); else echo $($WGET -q -O - --no-check-certificate $url | python - -e); fi"
      );
    case "sh/Mac/bash/json/Automate":
      return (
        "url=" +
        getMacDiagnosticsURL() +
        "; CURL=$(command -v curl); WGET=$(command -v wget); if [ ! -z $CURL ]; then echo $($CURL -s $url | sh); else echo $($WGET -q -O - --no-check-certificate $url | sh); fi"
      );
    default:
      throw "unknown os";
  }
}
