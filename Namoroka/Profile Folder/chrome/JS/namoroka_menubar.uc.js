// ==UserScript==
// @name			Namoroka :: Menu Bar
// @description 	Renames items in the Menu bar
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

var g_namorokaMenubar;

{
    var { renderElement, waitForElement, LocaleUtils, PrefCalls } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    renderElement = renderElement.bind(window);

    let menubarBundle = "chrome://namoroka/locale/properties/menus.properties";

    class NamorokaMenubar
    {
        // elm = renderElement;
        // rendered = false;

        // get _mainMenubar() {
        //     return document.getElementById("main-menubar");
        // }

        // get _mainMenubarItems() {
        //     return {
        //         "menu_FilePopup": [
        //             this.elm("xul:menuitem", 
        //                 {
        //                     "data-l10n-id": "new_window",
        //                     "command": "cmd_newNavigator",
        //                     "key": "key_newNavigator"
        //                 }
        //             ),
        //             this.elm("xul:menuitem", {
        //                     "data-l10n-id": "menu-file-new-window",
        //                     "onclick": "BrowserOpenTab()"
        //             })
        //         ],
        //         "menu_EditPopup": [
        //             this.elm("xul:menuitem", 
        //                 {
        //                     "data-l10n-id": "new_window",
        //                     "command": "cmd_newNavigator",
        //                     "key": "key_newNavigator"
        //                 }
        //             ),
        //             this.elm("xul:menuitem", {
        //                     "data-l10n-id": "menu-file-new-window",
        //                     "onclick": "BrowserOpenTab()"
        //             })
        //         ],
        //         "menu_viewPopup": [
        //             this.elm("xul:menuitem", 
        //                 {
        //                     "data-l10n-id": "new_window",
        //                     "command": "cmd_newNavigator",
        //                     "key": "key_newNavigator"
        //                 }
        //             ),
        //             this.elm("xul:menuitem", {
        //                     "data-l10n-id": "menu-file-new-window",
        //                     "onclick": "BrowserOpenTab()"
        //             })
        //         ],
        //         "menu_ToolsPopup": [
        //             this.elm("xul:menuitem", 
        //                 {
        //                     "data-l10n-id": "new_window",
        //                     "command": "cmd_newNavigator",
        //                     "key": "key_newNavigator"
        //                 }
        //             ),
        //             this.elm("xul:menuitem", {
        //                     "data-l10n-id": "menu-file-new-window",
        //                     "onclick": "BrowserOpenTab()"
        //             })
        //         ],
        //         "menu_HelpPopup": [
        //             this.elm("xul:menuitem", 
        //                 {
        //                     "data-l10n-id": "new_window",
        //                     "command": "cmd_newNavigator",
        //                     "key": "key_newNavigator"
        //                 }
        //             ),
        //             this.elm("xul:menuitem", {
        //                     "data-l10n-id": "menu-file-new-window",
        //                     "onclick": "BrowserOpenTab()"
        //             })
        //         ],
        //     }
        // }

        // renderMenuItems() {
        //     if (this.rendered)
        //         return;

        //     for (let menupopup in this._mainMenubarItems) {
        //         let menupopupElem = document.getElementById(menupopup);
        //         let items = this._mainMenubarItems[menupopup];

        //         for (let i = 0; i < menupopupElem.children.length; i++) {
        //             menupopupElem.removeChild(menupopupElem.children[i]);
        //         }
                
        //         // for (let i = 0; i < items.length; i++) {
        //         //     menuElem.appendChild(items[i]);
        //         // }
        //     }

        //     this.rendered = true;
        // }

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

            let style = PrefCalls.getPref("Namoroka.Appearance.Style");

            if (!style || style == 0) {
                label = LocaleUtils.str(menubarBundle, "history_old_label");
                accessKey = LocaleUtils.str(menubarBundle, "history_old_accesskey");
            }
            else {
                label = LocaleUtils.str(menubarBundle, "history_label");
                accessKey = LocaleUtils.str(menubarBundle, "history_accesskey");    
            }

            waitForElement("#history-menu").then(e => {   
                e.removeAttribute("data-l10n-id");
                e.setAttribute("label", label);
                e.setAttribute("accesskey", accessKey);  
            });
        }
    }

    g_namorokaMenubar = new NamorokaMenubar;
    g_namorokaMenubar._update();
    // g_namorokaMenubar.renderMenuItems();
}

window.document.documentElement.addEventListener(
    "namoroka-appearance-change",
    g_namorokaMenubar._update
)

// window.buildHelpMenu = function () {};
// gFileMenu = {};