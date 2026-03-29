// ==UserScript==
// @name			 Namoroka :: Toolbox
// @description 	 Common utilities for Namoroka scripts.
// @author			 ephemeralViolette
// @include			 main
// ==/UserScript==

var g_NamorokaToolbox;

{
    var { waitForElement } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    
    class NamorokaToolboxManager {
        async init() {
            await new Promise(resolve => {
                let delayedStartupObserver = (aSubject, aTopic, aData) => {
                    Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");
                    resolve();
                };
                Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");
            });

            let tabsToolbar = document.getElementById("TabsToolbar");

            let closeButton = window.MozXULElement.parseXULToFragment(`
                <hbox class="tabs-closebutton-box" align="center" pack="end">
                    <toolbarbutton class="tabs-closebutton close-icon" onclick="gBrowser.removeCurrentTab();">
                    </toolbarbutton>
                </hbox>
            `);

            tabsToolbar.querySelector("#TabsToolbar-customization-target").appendChild(closeButton);

            tabsToolbar.removeAttribute("flex");

            document.body.insertBefore(tabsToolbar, document.getElementById("browser"));

            waitForElement("#titlebar").then(e => {
                gNavToolbox.insertBefore(e.querySelector("#toolbar-menubar"), gNavToolbox.querySelector("#nav-bar"));

                e.remove();
            });
        }
    }

    g_NamorokaToolbox = new NamorokaToolboxManager;
    g_NamorokaToolbox.init();
}