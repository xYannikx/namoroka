// ==UserScript==
// @name			Namoroka :: Status Panel
// @description 	Implementation of the status panel on Firefox 1-3.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// ==/UserScript==

{
	var { PrefCalls, LocaleUtils, waitForElement } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    let menusBundle = "chrome://namoroka/locale/properties/menus.properties";
    let statusPanelBundle = "chrome://namoroka/locale/properties/status.properties";

    var NamorokaStatusPanel = {
        _fragment: null,

        get fragment() {
            if (!this._fragment) {
                this._fragment = window.MozXULElement.parseXULToFragment(`
                    <vbox id="browser-bottombox">
                        <statusbar id="status-bar">
                            <statusbarpanel id="statusbar-display" flex="1">
                                <label class="statusbarpanel-text" crop="right" flex="1" />
                            </statusbarpanel>
                        </statusbar>
                    </vbox>
                `).firstChild;
            }
            
            return this._fragment;
		},

        get _displayPanel() {
            return this.fragment.querySelector("#statusbar-display");
        },

        get _displayTextElement() {
            return this._displayPanel.querySelector("label");
        },

        get menuFragment() {
			return `
				<menuitem oncommand="NamorokaStatusPanel.setStatusBarState(Boolean(this.getAttribute('checked')))" type="checkbox" />
			`;
		},

        init() {
            document.body.appendChild(this.fragment);

            this.initStatusPanelVisibility();
            this.update();
        },

        initStatusPanelVisibility() {
			try
			{
				this._applyStatusBarEnabledPrefs();
			}
			catch (e)
			{
				if (e.name == "NS_ERROR_UNEXPECTED") // preference does not exist
				{
					try
					{
						PrefCalls.setPref("Namoroka.Status-Bar.Enabled", true);
					}
					catch (e) {}
				}
			}
			
			Services.prefs.addObserver("Namoroka.Status-Bar.Enabled", this._applyStatusBarEnabledPrefs.bind(this));
		},

        _onPopupShowing() {
			let item = document.querySelectorAll("#menu_NamorokaStatusBar");
			if (item)
			{
				item.forEach(elem => {
					elem.label = LocaleUtils.str(menusBundle, "namoroka_statusbar_label");
					elem.accessKey = LocaleUtils.str(menusBundle, "namoroka_statusbar_accesskey");

					let pref = Services.prefs.getBoolPref("Namoroka.Status-Bar.Enabled");

					if (pref == true)
					{
						elem.setAttribute("checked", "true");
					}
					else
					{
						elem.removeAttribute("checked");
					}
				});
			}
		},

        update() {
            if (BrowserHandler.kiosk)
                return

            let text;
            let type;
            let types = ["overlink"];
            
            if (XULBrowserWindow.busyUI) {
                types.push("status");
            }

            types.push("defaultStatus");

            for (type of types) {
                if ((text = XULBrowserWindow[type])) {
                    break;
                }
            }

            if (this._displayTextElement.value !== text) {
                this._label = text;
            }
        },
        
        set _label(val) {
            if (val) {
                this._displayTextElement.value = val;
            }
            else {
                this._displayTextElement.value = LocaleUtils.str(statusPanelBundle, "status_panel_done");
            }
        },

        setStatusBarState(state)
		{
			PrefCalls.setPref("Namoroka.Status-Bar.Enabled", state);
			this._hideStatusPanel(state);
		},

		_applyStatusBarEnabledPrefs() {
			let newState = PrefCalls.getPref("Namoroka.Status-Bar.Enabled");
			this._hideStatusPanel(newState);
		},

		_hideStatusPanel(state) {
			let panel = document.querySelector("#browser-bottombox");

			if (state == true)
			{
				panel.removeAttribute("hidden");
			}
			else
			{
				panel.setAttribute("hidden", "true");
			}

			let menuitem = document.querySelectorAll("#menu_NamorokaStatusBar");

			if (menuitem) {
				menuitem.forEach(elem => {
					if (state == true)
					{
						elem.setAttribute("checked", "true");
					}
					else {
						elem.removeAttribute("checked");
					}
				});
			}
		}
    }
    
    document.addEventListener("DOMContentLoaded", NamorokaStatusPanel.init(), false);

    StatusPanel.update = function update() {
        NamorokaStatusPanel.update();
    }

    waitForElement("#menu_viewPopup").then((menu) => {
		let statusBarItem = window.MozXULElement.parseXULToFragment(NamorokaStatusPanel.menuFragment).firstChild;
		statusBarItem.id = "menu_NamorokaStatusBar";
		menu.insertBefore(statusBarItem.cloneNode(), document.querySelector("#viewSidebarMenuMenu"));
		menu.addEventListener("popupshowing", NamorokaStatusPanel._onPopupShowing);
	});
}