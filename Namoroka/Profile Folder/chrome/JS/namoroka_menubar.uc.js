// ==UserScript==
// @name			Namoroka :: Menu Bar
// @description 	Renames items in the Menu bar
// @author			Travis
// @include			main
// ==/UserScript==

var g_namorokaMenubar;

{
    var { waitForElement, LocaleUtils } = ChromeUtils.import("chrome://userscripts/content/namoroka_utils.uc.js");
    waitForElement = waitForElement.bind(window);

    let menubarBundle = "chrome://namoroka/locale/properties/menus.properties";

    class NamorokaMenubar
    {
        async _update()
        {
            await new Promise(resolve => {
                let delayedStartupObserver = (aSubject, aTopic, aData) => {
                    if (aSubject == window) {
                        Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");
                        resolve();
                    }
                };
                Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");
            });

            var label;
            var accessKey;

            let style = PrefUtils.tryGetIntPref("Namoroka.Appearance.Style");

            if (!style || style == "0") {
                label = LocaleUtils.str(menubarBundle, "history_old_label");
                accessKey = LocaleUtils.str(menubarBundle, "history_old_accesskey");
            }
            else {
                label = LocaleUtils.str(menubarBundle, "history_label");
                accessKey = LocaleUtils.str(menubarBundle, "history_accesskey");    
            }

            waitForElement("#history-menu").then(e => {   
                e.setAttribute("label", label);
                e.setAttribute("accesskey", accessKey);  
            });
        }
    }

    g_namorokaMenubar = new NamorokaMenubar;
    g_namorokaMenubar._update();
}

window.document.documentElement.addEventListener(
    "namoroka-appearance-change",
    g_namorokaMenubar._update
)