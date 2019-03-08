<%@ WebHandler Language="C#" Class="Service" %>

using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using ScreenConnect;

[DemandPermission(PermissionInfo.AdministerPermission)]
public class Service : WebServiceBase
{
	public void NotifyCreatedVersionSessionGroup()
	{
		ExtensionRuntime.SaveExtensionSettingValues(ExtensionContext.Current.ExtensionID, new Dictionary<string, string>() { { "createdVersionSessionGroup", "1" } });
	}

	public void SetVersionCustomProperties()
	{
		var resourceManager = WebResourceManager.Instance;

		new List<string>() { "LabelText", "AccessVisible", "MeetingVisible", "SupportVisible" }.ForEach(delegate (string resource) {
			resourceManager.SaveResourceOverride("SessionProperty.Custom7." + resource, new Dictionary<string, string>() { { resource.Equals("LabelText") ? CultureInfo.CurrentCulture.Name : "InvariantCultureKey", resource.Equals("LabelText") ? WebResources.GetString("Diagnostics.Automate.VersionLabel") : "true" } }
				.Select(cultureKeyToOverrideValue =>
					Extensions.CreateKeyValuePair(
						cultureKeyToOverrideValue.Key == "InvariantCultureKey" ? CultureInfo.InvariantCulture : CultureInfo.GetCultureInfo(cultureKeyToOverrideValue.Key),
						(object)cultureKeyToOverrideValue.Value
					)
				)
			);
			resourceManager.SaveResourceOverride("SessionProperty.Custom6." + resource, new Dictionary<string, string>() { { resource.Equals("LabelText") ? CultureInfo.CurrentCulture.Name : "InvariantCultureKey", 
			resource.Equals("LabelText") ? WebResources.GetString("Diagnostics.Automate.IDLabel") : "true" } }
				.Select(cultureKeyToOverrideValue =>
					Extensions.CreateKeyValuePair(
						cultureKeyToOverrideValue.Key == "InvariantCultureKey" ? CultureInfo.InvariantCulture : CultureInfo.GetCultureInfo(cultureKeyToOverrideValue.Key),
						(object)cultureKeyToOverrideValue.Value
					)
				)
			);
		});

		var version = 0L;
		version = SessionManagerPool.Demux.WaitForChange(version, null);
	}
}