<%@ WebHandler Language="C#" Class="Service" %>
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using ScreenConnect;

[DemandPermission(PermissionInfo.AdministerPermission)]
public class Service : WebServiceBase
{
	public void NotifyCreatedVersionSessionGroup()
	{
		var runtime = ExtensionRuntime.TryGetExtensionRuntime(ExtensionContext.Current.ExtensionID);
		var settings = runtime.GetSettingValues(true);
		settings["createdVersionSessionGroup"] = "0";
		ExtensionRuntime.SaveExtensionSettingValues(ExtensionContext.Current.ExtensionID, settings);
	}

	public void SetVersionCustomProperties()
	{
		var resourceManager = WebResourceManager.Instance;
		var agentidproperty = Int32.Parse(ExtensionContext.Current.GetSettingValue("AgentIDCustomProperty"));
		var agentversionproperty = Int32.Parse(ExtensionContext.Current.GetSettingValue("AgentVersionCustomProperty"));

		new List<string>() { "LabelText", "AccessVisible", "MeetingVisible", "SupportVisible" }.ForEach(delegate (string resource) {
			resourceManager.SaveResourceOverride("SessionProperty.Custom"+ agentversionproperty +"." + resource, new Dictionary<string, string>() { { resource.Equals("LabelText") ? CultureInfo.CurrentCulture.Name : "InvariantCultureKey", resource.Equals("LabelText") ? WebResources.GetString("Diagnostics.Automate.VersionLabel") : "true" } }
				.Select(cultureKeyToOverrideValue =>
					Extensions.CreateKeyValuePair(
						cultureKeyToOverrideValue.Key == "InvariantCultureKey" ? CultureInfo.InvariantCulture : CultureInfo.GetCultureInfo(cultureKeyToOverrideValue.Key),
						(object)cultureKeyToOverrideValue.Value
					)
				)
			);
			resourceManager.SaveResourceOverride("SessionProperty.Custom"+ agentidproperty +"." + resource, new Dictionary<string, string>() { { resource.Equals("LabelText") ? CultureInfo.CurrentCulture.Name : "InvariantCultureKey", 
			resource.Equals("LabelText") ? WebResources.GetString("Diagnostics.Automate.IDLabel") : "true" } }
				.Select(cultureKeyToOverrideValue =>
					Extensions.CreateKeyValuePair(
						cultureKeyToOverrideValue.Key == "InvariantCultureKey" ? CultureInfo.InvariantCulture : CultureInfo.GetCultureInfo(cultureKeyToOverrideValue.Key),
						(object)cultureKeyToOverrideValue.Value
					)
				)
			);
		});
	}
}