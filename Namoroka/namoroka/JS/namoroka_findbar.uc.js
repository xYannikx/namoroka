// ==UserScript==
// @name			Namoroka :: Findbar
// @description 	Adds styling attributes for the findbar
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

var g_namorokaFindbar;

{
    var { renderElement, waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    renderElement = renderElement.bind(window);

    class NamorokaFindbar {
        _stringtable = Services.strings.createBundle("chrome://namoroka/locale/properties/findbar.properties");

        _init() {
            document.addEventListener("findbaropen", this._hookFindbar.bind(this));
        }

        _hookFindbar(event) {
            let findbar = event.target;

            if (!findbar || findbar.hasAttribute("namoroka-initialized"))
                return

            let findbarContainer = findbar.querySelector("[anonid='findbar-container'");

            let closeButton = findbar.querySelector("[anonid='find-closebutton']");

            let textBoxWrapper = findbar.querySelector("[anonid='findbar-textbox-wrapper']");
            let textBox = findbar.querySelector("[anonid='findbar-textbox']");

            let findPrevious = findbar.querySelector("[anonid='find-previous']");
            let findNext = findbar.querySelector("[anonid='find-next']");

            let findLabel = renderElement("xul:label", {
                "id": "find-label",
                "class": "findbar-find-fast",
                "control": "findbar-textbox",
                "value": this._stringtable.GetStringFromName("findbar_find_fast")
            });

            findbar.insertBefore(closeButton, findbar.firstChild);
            textBoxWrapper.insertBefore(findLabel, textBoxWrapper.firstChild);

            findPrevious.removeAttribute("data-l10n-id");
            findPrevious.label = this._stringtable.GetStringFromName("findbar_find_previous_label");
            findPrevious.accessKey = this._stringtable.GetStringFromName("findbar_find_previous_accesskey");
            findPrevious.tooltipText = this._stringtable.GetStringFromName("findbar_find_previous_tooltiptext");

            findNext.removeAttribute("data-l10n-id");
            findNext.label = this._stringtable.GetStringFromName("findbar_find_next_label");
            findNext.accessKey = this._stringtable.GetStringFromName("findbar_find_next_accesskey");
            findNext.tooltipText = this._stringtable.GetStringFromName("findbar_find_next_tooltiptext");

            textBoxWrapper.insertBefore(findNext, findPrevious);

            let findFieldContainer = renderElement("xul:hbox", {
                "id": "find-field-container",
                "class": "find-field-container findbar-find-fast"
            })

            textBoxWrapper.insertBefore(findFieldContainer, textBox);
            findFieldContainer.appendChild(textBox);

            let findbarHighlight = renderElement("xul:toolbarbutton", {
                "class": "findbar-highlight tabbable",
                "anonid": "highlight",
                "type": "checkbox"
            })

            findbarHighlight.label = this._stringtable.GetStringFromName("findbar_find_highlight_label");
            findbarHighlight.accessKey = this._stringtable.GetStringFromName("findbar_find_highlight_accesskey");
            findbarHighlight.tooltipText = this._stringtable.GetStringFromName("findbar_find_highlight_tooltiptext");

            findbarHighlight.addEventListener("command", event =>
                findbar.toggleHighlight(event.target.checked)
            );

            findbar.querySelector("checkbox[anonid='highlight']").replaceWith(findbarHighlight);

            let findStatusIcon = findbar.querySelector("[anonid='find-status-icon']");
            let findbarLabel = findbar.querySelectorAll(".findbar-label")[0];

            findbarContainer.insertBefore(findStatusIcon, findbarLabel);       
            
            textBoxWrapper.setAttribute("align", "center");

            findbar.setAttribute("namoroka-initialized", "true");
        }
    }

    g_namorokaFindbar = new NamorokaFindbar;
    g_namorokaFindbar._init();
}