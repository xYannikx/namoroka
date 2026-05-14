// ==UserScript==
// @name			Namoroka :: Title Text
// @description 	Changes the window title formats.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript===

{
    let { BrandUtils, WindowIconUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");

    let root = document.documentElement;
    let fullName = BrandUtils.getBrandingKey("brandFullName");

    let titles = {
        "default": fullName,
        "private": `${fullName} (Private Browsing)`,
        "contentDefault": `CONTENTTITLE - ${fullName}`,
        "contentPrivate": `CONTENTTITLE - ${fullName} (Private Browsing)`
    };

    root.dataset.titleDefault = titles.default;
    root.dataset.titlePrivate = titles.private;
    root.dataset.contentTitleDefault = titles.contentDefault;
    root.dataset.contentTitlePrivate = titles.contentPrivate;

    async function setDialogIcon() {
        const getKey = (key) => { try { return BrandUtils.getBrandingKey(key); } catch { return null; } };
        await WindowIconUtils.setDialogIcon(
            window,
            getKey("brandIcon16") || "chrome://branding/content/icon16.png",
            getKey("brandIcon32") || "chrome://branding/content/icon32.png",
        );
    }

    setDialogIcon();
}