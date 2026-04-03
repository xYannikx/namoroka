var g_namorokaAboutDialog;
var gSelectedPage = 0;

{
    var { waitForElement, BrandUtils, LocaleUtils, PrefCalls } = ChromeUtils.importESModule("chrome://userscripts/content/namoroka_utils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    
    ChromeUtils.defineESModuleGetters(window, {
        NamorokaThemeManager: "chrome://modules/content/NamorokaThemeManager.sys.mjs"
    });

    let g_themeManager = new NamorokaThemeManager;
    g_themeManager.init(
        document.documentElement,
        {
            style: true
        }
    );

    let aboutDialogBundle = "chrome://namoroka/locale/properties/aboutDialog.properties";

    class NamorokaAboutDialog
    {
        get versionTextInfo() {
            return [
                {
                    "style": 0,
                    "version": "1.0",
                    "copyright": "2004",
                    "renderingVersion": "1.7.5",
                    "engineBuild": "20041107",
                },
                {
                    "style": 1,
                    "version": "2.0",
                    "copyright": "2006",
                    "renderingVersion": "1.8.1",
                    "engineBuild": "20061010",
                },
                {
                    "style": 2,
                    "version": "3.0",
                    "copyright": "2008",
                    "renderingVersion": "1.9",
                    "engineBuild": "2008052906",
                },
            ]
        }

        get userAgentSpoof() {
            return [
                {
                    "name": "win95",
                    "platform": "win",
                    "version": "4.00"
                },
                {
                    "name": "win98",
                    "platform": "win",
                    "version": "4.10"
                },
                {
                    "name": "win2000",
                    "platform": "winnt",
                    "version": "5.0"
                },
                {
                    "name": "winxp",
                    "platform": "winnt",
                    "version": "5.1"
                },
                {
                    "name": "winsrv2003",
                    "platform": "winnt",
                    "version": "5.2"
                },
                {
                    "name": "winvista",
                    "platform": "winnt",
                    "version": "6.0"
                },
                {
                    "name": "win7",
                    "platform": "winnt",
                    "version": "6.1"
                },
            ]
        }

        init()
        {
            let aboutDialog = document.getElementById("aboutDialog");
            aboutDialog.setAttribute("title", LocaleUtils.str(aboutDialogBundle, "window_title", BrandUtils.getBrandingKey("brandFullName")));

            var style = PrefCalls.getPref("Namoroka.Appearance.Style");

            if (!style || style == 0) {
                style = 0;
            }

            this.setInfoText(style);
            this.populateUserAgentString();

            this.applyShadowRootButtonAttr();
        }

        setInfoText(style)
        {
            let info = this.versionTextInfo[style];

            let version = info?.version;
            let copyright = info?.copyright;

            let copyrightText = document.querySelector("#copyright");
            copyrightText.innerHTML = LocaleUtils.str(aboutDialogBundle, "copyright_label", copyright);
            
            let versionText = document.querySelector("#version");
            versionText.value = LocaleUtils.str(aboutDialogBundle, "version_label", version);
        }

        populateUserAgentString()
        {
            // Mozilla/5.0 (Windows; U; Windows NT 6.2; en-US; rv:1.8.1) Gecko/20061010 Firefox/2.0
            var style = PrefCalls.getPref("Namoroka.Appearance.Style");
            var spoof = PrefCalls.getPref("Namoroka.About.UserAgentSpoof");
            let info = this.versionTextInfo[style];

            var userAgentString;
            let userAgentField = document.querySelector("#userAgent");

            var platformVersion;
            var spoofId;

            switch (spoof) {
                case "win95":
                    spoofId = 0;
                    break;
                case "win98":
                    spoofId = 1;
                    break;
                case "win2000":
                    spoofId = 2;
                    break;
                case "winxp":
                    spoofId = 3;
                    break;
                case "winsrv2003":
                    spoofId = 4;
                    break;
                case "winvista":
                    spoofId = 5;
                    break;
                case "win7":
                    spoofId = 6;
                    break;
                default: 
                    userAgentString = navigator.userAgent;
                    userAgentField.innerHTML = userAgentString;
                    return;
            }

            var platform = this.userAgentSpoof[spoofId].platform;

            if (platform == "winnt") {
                platformVersion = LocaleUtils.str(aboutDialogBundle, "useragent_platform_windows_nt",  this.userAgentSpoof[spoofId].version);
            }
            else if (platform == "win") {
                let platformName = this.userAgentSpoof[spoofId].name;

                if (platformName == "win95") {
                    platformVersion = LocaleUtils.str(aboutDialogBundle, "useragent_platform_windows_95");
                }
                else if (platformName == "win98") {
                    platformVersion = LocaleUtils.str(aboutDialogBundle, "useragent_platform_windows_98");
                }
            }

            let userAgentTable = {
                "locale": window.navigator.language,
                "renderingVersion": info?.renderingVersion,
                "engineBuild": info?.engineBuild,
                "version": info?.version,
                "browserName": BrandUtils.getBrandingKey("brandShortName")
            }

            userAgentString = `Mozilla/5.0 (${LocaleUtils.str(aboutDialogBundle, "useragent_platform_windows")}; U; ${platformVersion}; ${userAgentTable.locale}; rv:${userAgentTable.renderingVersion}) Gecko/${userAgentTable.engineBuild} ${userAgentTable.browserName}/${userAgentTable.version}`;

            userAgentField.innerHTML = userAgentString;
        }

        applyShadowRootButtonAttr()
        {
            // Credits button label
            let creditsButtonElem = document.documentElement.getButton("extra2");
            let acceptButtonElem = document.documentElement.getButton("accept");

            creditsButtonElem.setAttribute("label", LocaleUtils.str(aboutDialogBundle, "credits_button_label"));
            creditsButtonElem.addEventListener("command", this.switchPage, false);

            // Extra attributes for styling purposes
            acceptButtonElem.setAttribute("part", "accept")
            creditsButtonElem.setAttribute("part", "credits");
        }

        switchPage(aEvent)
        {
            let creditsButtonElem = aEvent.target;
            
            if (creditsButtonElem.localName != "button")
                return;

            let creditsBrowser = document.querySelector("#creditsPage");
            if (gSelectedPage == 0) 
            {
                creditsBrowser.setAttribute("src", "chrome://userchrome/content/windows/aboutDialog/credits.xhtml");
                creditsButtonElem.setAttribute("label", LocaleUtils.str(aboutDialogBundle, "about_label", BrandUtils.getBrandingKey("brandFullName")));
                gSelectedPage = 1;
            }
            else 
            {
                creditsBrowser.removeAttribute("src");
                creditsButtonElem.setAttribute("label", LocaleUtils.str(aboutDialogBundle, "credits_button_label"));
                gSelectedPage = 0;
            }

            let modes = document.getElementById("modes");
            modes.selectedIndex = gSelectedPage;
        }
    }

    window.addEventListener("load", () => {
        g_namorokaAboutDialog = new NamorokaAboutDialog();
        g_namorokaAboutDialog.init();
    });
}

function visitLink(aEvent) {
    var node = aEvent.target;
    while (node.nodeType != Node.ELEMENT_NODE)
        node = node.parentNode;
    var url = node.getAttribute("link");
    if (!url)
        return;

    var protocolSvc = Components.classes["@mozilla.org/uriloader/external-protocol-service;1"]
        .getService(Components.interfaces.nsIExternalProtocolService);
    var ioService = Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
    var uri = ioService.newURI(url, null, null);

    // if the scheme is not an exposed protocol, then opening this link
    // should be deferred to the system's external protocol handler
    if (protocolSvc.isExposedProtocol(uri.scheme)) {
        var win = window.top;
        if (win instanceof Components.interfaces.nsIDOMChromeWindow) {
            while (win.opener && !win.opener.closed)
                win = win.opener;
        }
        win.open(uri.spec);
    } else
        protocolSvc.loadUrl(uri);
}
