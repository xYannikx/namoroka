// ==UserScript==
// @name			Namoroka :: Tab Scrollbox
// @description 	Applies custom styles to the arrowscrollbox element.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

{
    var { waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    waitForElement("#tabbrowser-arrowscrollbox").then(e =>
    {
        let link  = document.createElement("link");
        link.rel  = "stylesheet";
        link.href = "chrome://userchrome/content/tabscrollbox.uc.css";
        e.shadowRoot.append(link);

        function isVisuallySelected(list) {
            for (let mut of list) {
                setTab(mut.target);
            }
        }
        
        function setTab(mut) {
            let tab = mut;

            if (tab.nodeName == "tab") {
                if (tab.hasAttribute("visuallyselected") 
                    && tab.getAttribute("visuallyselected") !== "true") {
                    tab.setAttribute("visuallyselected", "true");
                }
            }
        }

        let observer = new MutationObserver(isVisuallySelected);
        observer.observe(e, { 
            childList: true,
            attributes: true,
            subtree: true,
            attributeFilter: ["visuallyselected"]
        });

        let delayedStartupObserver = (aSubject, aTopic, aData) => {
            if (aSubject == window) {
                Services.obs.removeObserver(delayedStartupObserver, "browser-delayed-startup-finished");
                setTab(gBrowser.selectedTab);
            }
        };
        Services.obs.addObserver(delayedStartupObserver, "browser-delayed-startup-finished");
    });
}