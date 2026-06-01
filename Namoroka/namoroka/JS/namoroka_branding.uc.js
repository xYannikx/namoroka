// ==UserScript==
// @name			Namoroka :: Branding
// @description 	Register brand FTLs.
// @author			aubymori
// @include			main
// @onlyonce
// ==/UserScript===

{
    var { PrefCalls } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");

    const FTL_FILES = [
        "branding/brand.ftl",
        "browser/aboutDialog.ftl"
    ];

    let brand = Services.prefs.getStringPref("Namoroka.Option.Branding", "firefox");
    if (brand != "")
    {
        let chromeRegistry = Cc["@mozilla.org/chrome/chrome-registry;1"].getService(Ci.nsIChromeRegistry);
        let baseChromeURI = `chrome://namoroka/content/branding/${brand}/ftls/`;

        let root = chromeRegistry.convertChromeURL(Services.io.newURI(baseChromeURI)).spec;
        console.log(`Root: ${root}`);

        let paths = [];
        for (const filename of FTL_FILES)
        {
            let file = baseChromeURI + filename;
            let path = chromeRegistry.convertChromeURL(Services.io.newURI(file)).spec;
            console.log(`Adding file: ${path}`);
            paths.push(path);
        }

        if (paths.length > 0)
        {
            let locale = Services.locale.appLocalesAsBCP47;
            let source = new L10nFileSource(
                "namoroka",
                "app",
                locale,
                root,
                {
                    addResourceOptions: {
                        allowOverrides: true
                    }
                },
                paths
            );
            console.log(source);
            L10nRegistry.getInstance().registerSources([source]);
        }
    }
}