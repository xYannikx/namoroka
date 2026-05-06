// ==UserScript==
// @name			Namoroka :: URLbar
// @description 	Several modifications to the URlBar
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// ==/UserScript==

{
    var { waitForElement, LocaleUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    waitForElement("#urlbar").then(e => {
        let dropmarker = window.MozXULElement.parseXULToFragment(`
            <dropmarker id="historydropmarker" class="autocomplete-history-dropmarker urlbar-history-dropmarker">
                    <stack class="history-dropmarker-stack">
                    <vbox class="autocomplete-dropmarker-bkgnd-box">
                        <image class="autocomplete-dropmarker-bkgnd-top autocomplete-dropmarker-bkgnd"/>
                        <vbox flex="1" class="autocomplete-dropmarker-inner-box">
                            <image flex="1" class="autocomplete-dropmarker-bkgnd-mid-top autocomplete-dropmarker-bkgnd"/>
                            <image flex="1" class="autocomplete-dropmarker-bkgnd-mid-bottom autocomplete-dropmarker-bkgnd"/>
                        </vbox>
                        <image class="autocomplete-dropmarker-bkgnd-bottom autocomplete-dropmarker-bkgnd"/>
                    </vbox>
                    <hbox align="center" class="dropmarker-image-container">
                        <image class="dropmarker-image"/>
                    </hbox>
                </stack>
            </dropmarker>
        `);
        

        let urlbarInputContainer = gURLBar._inputContainer;
        urlbarInputContainer.appendChild(dropmarker);

        e.querySelector(".urlbar-history-dropmarker").addEventListener("mousedown", openURLView);
        
        function openURLView() {
            // Related Firefox code involving opening the URLbar Dropdown seems to use
            // Private Properties, so this will do for now.
            gURLBar._inputContainer.click();
            gURLBar.searchMode = {
                source: UrlbarUtils.RESULT_SOURCE.BOOKMARKS,
                entry: "shortcut",
            };
            gURLBar.search(gURLBar.value);
            gURLBar.select();
        }

        // favicon

        let pageProxyDeck = window.MozXULElement.parseXULToFragment(`
            <deck id="page-proxy-deck">
                <html:img decoding="sync" id="page-proxy-favicon" />
            </deck>
        `);

        urlbarInputContainer.insertBefore(pageProxyDeck, urlbarInputContainer.firstChild);

        let pageProxyStack = window.MozXULElement.parseXULToFragment(`
            <stack id="page-proxy-stack">
                <image id="page-proxy-favicon" />
            </stack>    
        `)

        gIdentityHandler._identityIconBox.insertBefore(pageProxyStack, gIdentityHandler._identityIconLabel);

        // im chopped

        function moveIdentityBox() {
            let identityBox = gIdentityHandler._identityBox;
            let style = PrefCalls.getPref("Namoroka.Appearance.Style");

            if (style >= "2") {
                urlbarInputContainer.insertBefore(identityBox, urlbarInputContainer.firstChild);
            }
            else {
                urlbarInputContainer.insertBefore(identityBox, urlbarInputContainer.lastChild);
            }
        }
        
        document.addEventListener(
            "namoroka-appearance-change",
            moveIdentityBox
        )
        moveIdentityBox();
    });

    function updateIcon()
    {
        try
        {
            setTimeout(function()
            {
                let pageProxyIcon = document.querySelectorAll("#page-proxy-favicon");
                let favicon = gBrowser.selectedTab.iconImage.src;
                    
                pageProxyIcon.forEach(el => {
                    el.setAttribute("src", favicon);

                    if (!favicon || favicon == null || favicon == "chrome://branding/content/icon32.png")
                    {
                        el.removeAttribute("src");
                    }
                })
            }, 1);
        }
        catch (e) {}
    }

    document.addEventListener("TabAttrModified", updateIcon, false);
    document.addEventListener("TabSelect", updateIcon, false);
    document.addEventListener("TabOpen", updateIcon, false);
    document.addEventListener("TabClose", updateIcon, false);
    document.addEventListener("load", updateIcon, false);
}