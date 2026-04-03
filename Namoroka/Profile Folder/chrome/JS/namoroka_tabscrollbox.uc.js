// ==UserScript==
// @name			Namoroka :: Tab Scrollbox
// @description 	Applies custom styles to the arrowscrollbox element.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

{
    var { waitForElement } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    waitForElement("#tabbrowser-arrowscrollbox").then(e =>
    {
        let link  = document.createElement("link");
        link.rel  = "stylesheet";
        link.href = "chrome://userchrome/content/tabscrollbox.uc.css";
        e.shadowRoot.append(link);
    });
}