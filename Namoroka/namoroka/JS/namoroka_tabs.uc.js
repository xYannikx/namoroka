// ==UserScript==
// @name			Namoroka :: Tabs
// @description 	Tabs
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

{
    var { waitForElement, PrefUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    waitForElement("#tabbrowser-arrowscrollbox").then(e => {
        function hideTabs()
        {
            let numTabs = gBrowser.tabs.length;
            let hideTabsPref = PrefCalls.getPref("Namoroka.Tabbrowser.HideOnOneTab");
            let ifHide = hideTabsPref ? numTabs <= 1 : false;

            document.querySelector("#TabsToolbar").setAttribute("hidden", ifHide ? "true" : "false");
        }

        function updateTabs()
        {
            for (tab of e.children)
            {
                let background = tab.querySelector(".tab-background");
                if (background) {
                    if (!background.querySelector(".tab-background-start")) {
                        let backgroundXUL = MozXULElement.parseXULToFragment(
                        `
                            <hbox class="tab-background-start" />
                            <hbox class="tab-background-middle" />
                            <hbox class="tab-background-end" />
                        `);
                        background.append(backgroundXUL);
                    }
                }
            }

            hideTabs();
        }

        let observer = new MutationObserver(updateTabs);
        observer.observe(e, { childList: true });

        updateTabs();
    });
}

{
    let delayedStartupObserver = (aSubject, aTopic, aData) => {
        if (aSubject == window) {
            Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");

            let tabsElement = gBrowser.tabContainer;
            let _animateTabMove_orig = tabsElement._animateTabMove;

            let clearTransformsFrameId = null;

            tabsElement._animateTabMove = function _animateTabMove(event) {
                _animateTabMove_orig.call(this, event);

                if (clearTransformsFrameId) {
                    cancelAnimationFrame(clearTransformsFrameId);
                }

                let clearTransforms = () => {
                    for (let tab of tabsElement.allTabs) {
                        tab.style.transform = "";
                    }
                    clearTransformsFrameId = requestAnimationFrame(clearTransforms);
                };
                
                clearTransformsFrameId = requestAnimationFrame(clearTransforms);
            };

            tabsElement.finishAnimateTabMove = function finishAnimateTabMove() {
                if (clearTransformsFrameId) {
                    cancelAnimationFrame(clearTransformsFrameId);
                    clearTransformsFrameId = null;
                }

                for (let tab of tabsElement.allTabs) {
                    tab.style.transform = "";
                }

                tabsElement.removeAttribute("movingtab");
                tabsElement.removeAttribute("movingtab-createGroup");
                tabsElement.removeAttribute("movingtab-ungroup");
                tabsElement.removeAttribute("movingtab-addToGroup");
            };
        }
    };
    Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");
}