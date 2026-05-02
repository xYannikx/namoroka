// ==UserScript==
// @name			Namoroka :: Sidebar
// @description 	En gewt?
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// @include         chrome://browser/content/places/bookmarksSidebar.xhtml
// @include         chrome://browser/content/places/historySidebar.xhtml
// ==/UserScript==

{
	var { PrefCalls, LocaleUtils, waitForElement, renderElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    renderElement = renderElement.bind(window);

    const BOOKMARKS_SIDEBAR_URL = "chrome://browser/content/places/bookmarksSidebar.xhtml";
    const HISTORY_SIDEBAR_URL = "chrome://browser/content/places/historySidebar.xhtml";

    class NamorokaSidebarController {    
        _sidebarHeader = null;
        _sidebarTitle = null;
        _sidebarThrobber = null;
        _toolbarButton = null;

        get _isContextBookmarksSidebar() {
            return document.URL == BOOKMARKS_SIDEBAR_URL;
        }

        get _isContextHistorySidebar() {
            return document.URL == HISTORY_SIDEBAR_URL;
        }

        get _isContextBrowser() {
            return document.URL.endsWith("browser.xhtml");
        }
    
        constructor() {
            this._init();
        }

        async _init() {
            if (this._isContextBookmarksSidebar || this._isContextHistorySidebar) {
                this._createSidebarLabel();
            }

            if (this._isContextBrowser) {
                await SidebarController.promiseInitialized.then(() => {
                    this._sidebarHeader = document.getElementById("sidebar-header");
                    this._sidebarTitle = document.getElementById("sidebar-title");
                    this._sidebarThrobber = document.getElementById("sidebar-throbber");
                    this._toolbarButton = document.getElementById("sidebar-switcher-target");

                    this._renderSidebar();
                });
            }
        }

        _renderSidebar() {
            this._sidebarHeader.insertBefore(this._sidebarTitle, this._sidebarThrobber);
            this._toolbarButton.remove();
        }

        async _createSidebarLabel() {
            let searchBox = await waitForElement("#search-box");

            let controlLabel = renderElement("label", {
                value: "Search:",
                accesskey: "S",
                control: "search-box"
            });

            searchBox.removeAttribute("placeholder");

            searchBox.parentNode.insertBefore(controlLabel, searchBox);
        }
    }

    window.g_NamorokaSidebarController = new NamorokaSidebarController();
}