// ==UserScript==
// @name			 Namoroka :: Toolbox
// @description 	 Common utilities for Namoroka scripts.
// @author			 ephemeralViolette
// @include			 main
// ==/UserScript==

var g_NamorokaToolbox;

{
    var { waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
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
                    <toolbarbutton id="tabs-closebutton" class="tabs-closebutton close-icon">
                    </toolbarbutton>
                </hbox>
            `).firstChild;

            closeButton.querySelector("#tabs-closebutton").addEventListener("click", (e) => {
                gBrowser.removeCurrentTab();
            });

            tabsToolbar.querySelector("#TabsToolbar-customization-target").appendChild(closeButton);

            tabsToolbar.removeAttribute("flex");

            document.body.insertBefore(tabsToolbar, document.getElementById("browser"));

            // TabsToolbar is now outside gNavToolbox, so Firefox's internal
            // drag-and-drop code may fail to clear `movingtab` on drop/cancel.
            // Watch for stale attributes and remove them after a short delay.
            let movingtabObserver = new MutationObserver(() => {
                if (gNavToolbox.hasAttribute("movingtab")) {
                    setTimeout(() => {
                        if (gNavToolbox.hasAttribute("movingtab")) {
                            gNavToolbox.removeAttribute("movingtab");
                        }
                    }, 500);
                }
            });
            movingtabObserver.observe(gNavToolbox, { attributes: true, attributeFilter: ["movingtab"] });

            waitForElement("#titlebar").then(e => {
                gNavToolbox.insertBefore(e.querySelector("#toolbar-menubar"), gNavToolbox.querySelector("#nav-bar"));

                e.remove();
            });

            this.initURLBarWidth();

            this.renderMozWinGlassElem();
        }

        renderMozWinGlassElem()
        {
            let glassElem = document.createXULElement("box");
            glassElem.id = "mozGlassHandler";

            document.documentElement.append(glassElem);
        }

        initURLBarWidth()
		{
			let toolbar = gURLBar.textbox.closest("toolbar");

			if (toolbar) {
				let urlbar = gURLBar.textbox;

				// Check if URLBar isn't a XUL element
				if (urlbar.nodeName != "hbox") {
                    const updateWidth = (el) => {
                        const rect = el.getBoundingClientRect();
                        const width = rect?.width;

                        if (!width || width <= 0) return;

                        textbox.style.setProperty(
                            "--urlbar-width",
                            `${width}px`
                        );
                    };

                    let _resizeObserver = new ResizeObserver(([entry]) => {
                        updateWidth(entry);
                    });

                    document.addEventListener("namoroka-appearance-change", () => {
                        updateWidth(textbox);
                    });
                    
					// Observer the sizing of the custom element.
                    requestAnimationFrame(() => {
                        _resizeObserver.observe(urlbar);
                    });
				}
			}
		}
    }

    g_NamorokaToolbox = new NamorokaToolboxManager;
    g_NamorokaToolbox.init();
}