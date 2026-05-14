{
    let {
        classes: Cc,
        interfaces: Ci,
        manager: Cm,
        utils: Cu
    } = Components;

    // Branding: Registration of content
    let prefs = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
    let defaultBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getDefaultBranch("");
    defaultBranch.setStringPref("Namoroka.Option.Branding", "firefox");
    let branding = prefs.getStringPref("Namoroka.Option.Branding", "firefox");
    let style = prefs.getIntPref("Namoroka.Appearance.Style", 1);
    if (branding != "")
    {
        let ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
        let registry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
        let brandingPath = `chrome://namoroka/content/branding/${branding}${style >= 3 && branding == "firefox" ? "/new" : ""}/chrome.manifest`;
        let brandingFileURI = registry.convertChromeURL(ios.newURI(brandingPath)).QueryInterface(Ci.nsIFileURL);
        let brandingManifest = brandingFileURI.file;
        if (brandingManifest.exists())
        {
            Cm.QueryInterface(Ci.nsIComponentRegistrar).autoRegister(brandingManifest);
        }
    }
}