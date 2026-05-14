// ==UserScript==
// @name			Namoroka :: Options
// @description 	Adds the menu item to launch Namoroka's Options window
// @author			aubymori
// @include			main
// ==/UserScript==

{
    var { LocaleUtils, waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    let menusBundle = "chrome://namoroka/locale/properties/menus.properties";

    function onPopupShowing()
    {
        let item = document.querySelectorAll("#menu_namorokaOptions");
        if (item)
        {
            item.forEach(elem => {
                elem.label = LocaleUtils.str(menusBundle, "namoroka_options_label");
                elem.accessKey = LocaleUtils.str(menusBundle, "namoroka_options_accesskey");
            });
        }
        item = document.querySelectorAll("#toolbar-context-namorokaOptions");
        if (item) {
            item.forEach(elem => {
                elem.label = LocaleUtils.str(menusBundle, "namoroka_options_label");
                elem.accessKey = LocaleUtils.str(menusBundle, "namoroka_options_accesskey");
            });
        }
    }

    function launchNamorokaOptions()
    {
        window.openDialog(
            "chrome://namoroka/content/windows/options/options.xhtml",
            LocaleUtils.str(menusBundle, "namoroka_options_label"),
            "chrome,centerscreen,resizeable=no,dependent"
        ); 
    }

    function onNamorokaPrefsCommand(aEvent) {
        launchNamorokaOptions();
    }

    function createNamorokaPrefsItem(aID) {
        let menuitem = document.createXULElement("menuitem");

        menuitem.id = aID;
        menuitem.addEventListener("command", onNamorokaPrefsCommand);

        return menuitem;
    }


    waitForElement("#menu_ToolsPopup").then((menu) => {
        menu.append(createNamorokaPrefsItem("menu_namorokaOptions"));
        menu.addEventListener("popupshowing", onPopupShowing);
    });
    
    waitForElement("#toolbar-context-menu").then((menu) => {
        menu.insertBefore(createNamorokaPrefsItem("toolbar-context-namorokaOptions"), document.querySelector(".viewCustomizeToolbar"));
        menu.addEventListener("popupshowing", onPopupShowing);
    });
}