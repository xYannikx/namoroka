// ==UserScript==
// @name			 Namoroka :: Tab Scrollbox
// @description 	 Applies custom styles to the arrowscrollbox element.
// @author			 Travis
// @include			 main
// ==/UserScript==

{
    var { waitForElement } = ChromeUtils.import("chrome://userscripts/content/namoroka_utils.uc.js");
    waitForElement = waitForElement.bind(window);

    waitForElement("#tabbrowser-arrowscrollbox").then(e =>
    {
        console.log("got it");
        let link  = document.createElement("link");
        link.rel  = "stylesheet";
        link.href = "chrome://userchrome/content/tabscrollbox.uc.css";
        e.shadowRoot.append(link);
    });
}