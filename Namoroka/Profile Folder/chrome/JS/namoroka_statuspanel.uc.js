// ==UserScript==
// @name			Namoroka :: Status Panel
// @description 	Implementation of the status panel on Firefox 1-3.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// ==/UserScript==

{
	var { PrefCalls, LocaleUtils, waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    let menusBundle = "chrome://namoroka/locale/properties/menus.properties";
    let statusPanelBundle = "chrome://namoroka/locale/properties/status.properties";

    gIdentityHandler.getEffectiveHost = function _getEffectiveHost() {
        if (!this._eTLDService) {
            this._eTLDService = Cc["@mozilla.org/network/effective-tld-service;1"].getService(
                Ci.nsIEffectiveTLDService
            );
        }

        if (!this._IDNService) {
            this._IDNService = Cc["@mozilla.org/network/idn-service;1"].getService(
                Ci.nsIIDNService
            );
        }

        try {
            let baseDomain =
                this._eTLDService.getBaseDomainFromHost(this._uri.host);
            return this._IDNService.convertToDisplayIDN(baseDomain, {});
        } catch (e) {
            // If something goes wrong (e.g. host is an IP address) just fail back
            // to the full domain.
            return this._uri.host || "";
        }
    }

	gIdentityHandler.refreshIdentityBlock = function refreshIdentityBlock() {
		if (!this._identityBox) {
			return;
		}

		
		this._refreshIdentityIcons();

		// If this condition is true, the URL bar will have an "invalid"
		// pageproxystate, so we should hide the permission icons.
		if (this._hasInvalidPageProxyState()) {
			gPermissionPanel.hidePermissionIcons();
		} else {
			gPermissionPanel.refreshPermissionIcons();
		}

		if (this._isSecureContext && !this._isSecureInternalUI) {
			document.querySelector("#status-bar #security-button").setAttribute("level", "high");
		}
		else {
			document.querySelector("#status-bar #security-button").removeAttribute("level");
		}

        if (this._isSecureContext && !this._isSecureInternalUI && this.getEffectiveHost()) {
            document.querySelector("#status-bar #security-button .statusbarpanel-text").setAttribute("value", this.getEffectiveHost());
		}
		else {
            document.querySelector("#status-bar #security-button .statusbarpanel-text").removeAttribute("value");
		}

		// Hide the shield icon if it is a chrome page.
		gProtectionsHandler._trackingProtectionIconContainer.classList.toggle(
			"chromeUI",
			this._isSecureInternalUI
		);
	}

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
                            <statusbarpanel class="statusbarpanel-progress" id="statusbar-progresspanel" collapsed="true">
                                <html:progress class="progressmeter-statusbar" id="statusbar-icon" max="100" value="0" />
                            </statusbarpanel>   
                            <statusbarpanel id="security-button" class="statusbarpanel-iconic-text">
                                <image class="statusbarpanel-icon" />
                                <label class="statusbarpanel-text" />
                            </statusbarpanel>
                            <statusbarpanel class="statusbar-resizerpanel">
                                <html:div class="statusbar-resizer" />
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

        get _progressPanel() {
            return document.querySelector("#statusbar-progresspanel");
        },

        get _progressMeter() {
            return document.querySelector("#statusbar-icon");
        },

        get _resizerPanel() {
            return document.querySelector(".statusbar-resizerpanel");
        },

        get _resizerGrip() {
            return document.querySelector(".statusbar-resizer");
        },

        _progressCollapseTimer: null,

        get menuFragment() {
			return `
				<menuitem type="checkbox" />
			`;
		},

        init() {
            this.fragment.querySelector("#security-button").addEventListener("dblclick", (e) => {
                BrowserCommands.pageInfo(null, "securityTab");
            })

            document.body.appendChild(this.fragment);

			this.initStatusPanelVisibility();
            this.initResizer();
            this.update();

            let delayedStartupObserver = (aSubject, aTopic, aData) => {
                if (aSubject == window) {
                    Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");
                    this.initProgressListener();
                }
            };
            Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");

            this._displayTextElement.value = LocaleUtils.str(statusPanelBundle, "status_panel_done");
        },

        initProgressListener() {
            let self = this;

            this._progressListener = {
                QueryInterface: ChromeUtils.generateQI([
                    "nsIWebProgressListener",
                    "nsISupportsWeakReference",
                ]),

                onProgressChange(aWebProgress, aRequest,
                                 aCurSelfProgress, aMaxSelfProgress,
                                 aCurTotalProgress, aMaxTotalProgress) {
                    if (aMaxTotalProgress > 0) {
                        let percentage = (aCurTotalProgress * 100) / aMaxTotalProgress;
                        self._progressMeter.value = percentage;
                    }
                },

                onStateChange(aWebProgress, aRequest, aStateFlags, aStatus) {
                    const nsIWPL = Ci.nsIWebProgressListener;

                    if (aStateFlags & nsIWPL.STATE_START && aStateFlags & nsIWPL.STATE_IS_NETWORK) {
                        self._progressMeter.value = 0;

                        if (self._progressCollapseTimer) {
                            window.clearTimeout(self._progressCollapseTimer);
                            self._progressCollapseTimer = null;
                        } else {
							self._progressPanel.collapsed = false;
                        }
                    } else if (aStateFlags & nsIWPL.STATE_STOP && aStateFlags & nsIWPL.STATE_IS_NETWORK) {
                        self._progressCollapseTimer = window.setTimeout(() => {
                            self._progressPanel.collapsed = true;
                            self._progressCollapseTimer = null;
                        }, 100);
                    }
                },

                onLocationChange() {},
                onSecurityChange() {},
                onStatusChange() {},
                onContentBlockingEvent() {},
            };

            gBrowser.addProgressListener(this._progressListener);
        },

        initResizer() {
            let grip = this._resizerGrip;
            
			if (!grip) 
				return;

            let startX, startY, startWidth, startHeight;

            grip.addEventListener("mousedown", (e) => {
                if (e.button !== 0) return;
                if (window.windowState === window.STATE_MAXIMIZED || window.fullScreen) return;

                startX = e.screenX;
                startY = e.screenY;
                startWidth = window.outerWidth;
                startHeight = window.outerHeight;

                let onMouseMove = (e) => {
                    let newWidth = startWidth + (e.screenX - startX);
                    let newHeight = startHeight + (e.screenY - startY);
                    window.resizeTo(newWidth, newHeight);
                };

                let onMouseUp = () => {
                    window.removeEventListener("mousemove", onMouseMove, true);
                    window.removeEventListener("mouseup", onMouseUp, true);
                };

                window.addEventListener("mousemove", onMouseMove, true);
                window.addEventListener("mouseup", onMouseUp, true);

                e.preventDefault();
            });
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
            let types = ["overLink"];
            
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
		statusBarItem.addEventListener("command", (e) => {
			NamorokaStatusPanel.setStatusBarState(Boolean(statusBarItem.getAttribute('checked')));
		});
		menu.insertBefore(statusBarItem, document.querySelector("#viewSidebarMenuMenu"));
		menu.addEventListener("popupshowing", NamorokaStatusPanel._onPopupShowing);
	});

    // Remove the delay between hovering/unhovering a link and the statusbar updating
    Object.defineProperty(LinkTargetDisplay, "DELAY_SHOW", { value: 0 });
    Object.defineProperty(LinkTargetDisplay, "DELAY_HIDE", { value: 0 });
}