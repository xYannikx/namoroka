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