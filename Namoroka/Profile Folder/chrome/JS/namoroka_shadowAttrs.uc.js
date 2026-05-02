// ==UserScript==
// @name			Namoroka :: Shadow DOM Appearance
// @description 	Styling attributes for certain shadow dom elements.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include         main
// @include         (.*)
// @ignorecache
// ==/UserScript==

{
    var { PrefCalls } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");

    let controls = [
        "search-textbox",
        "arrowscrollbox",
    ]

    function onMutation(list)
    {
        for (const control of document.querySelectorAll(`:is(${controls.join(", ")})`))
        {
            let textbox = control;

            let style = PrefCalls.getPref("Namoroka.Appearance.Style");
            let aero = PrefCalls.getPref("Namoroka.Appearance.Aero");

            for (let attr of textbox.getAttributeNames())
            {
                if (attr.indexOf("namoroka-style-") > -1 || attr.includes("namoroka-appearance-aero"))
                {
                    textbox.removeAttribute(attr);
                }
            }

            for (let i = 1; i <= style; i++)
            {
                textbox.setAttribute(`namoroka-style-${i}`, "true");
            }

            if (aero) {
                textbox.setAttribute("namoroka-appearance-aero", "true");
            }
        }

        for (const control of document.querySelectorAll("search-textbox"))
        {
            if (control.shadowRoot.querySelector("link[href='chrome://userchrome/content/namoroka.uc.css']"))
                continue;

            let link  = document.createElement("link");
            link.rel  = "stylesheet";
            link.href = "chrome://userchrome/content/namoroka.uc.css";

            control.shadowRoot.append(link);
        }
    }

    const onThemeUpdate = {
        observe: function (subject, topic, data) {
            if (topic == "nsPref:changed")
                onMutation();
        },
    };

    Services.prefs.addObserver("Namoroka.Appearance.Style", onThemeUpdate, false);
    Services.prefs.addObserver("Namoroka.Appearance.Aero", onThemeUpdate, false);

    let documentElementObserver = new MutationObserver(onMutation);
    documentElementObserver.observe(document.documentElement, { childList: true, subtree: true });
}