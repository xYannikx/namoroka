var g_NamorokaOptionsDialog;
{
    const { LocaleUtils, 
        PrefCalls, 
        BrandUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
        
    ChromeUtils.defineESModuleGetters(window, {
        CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
        NamorokaThemeManager: "chrome://modules/content/NamorokaThemeManager.sys.mjs",
        NamorokaUpdateChecker: "chrome://modules/content/NamorokaUpdateChecker.sys.mjs",
        NamorokaLayoutTemplateManager: "chrome://modules/content/NamorokaLayoutTemplateManager.sys.mjs",
    });

    let g_themeManager = new NamorokaThemeManager(
        document.documentElement,
        {
            style: true,
            prefs: [
                "Namoroka.Appearance.Aero",
                "Namoroka.Option.Debug",
            ]
        }
    );

    class NamorokaOptionsDialog {
        stringbundle = "chrome://namoroka/locale/properties/namoroka-options.properties";

        _previousCustomizableUILayout = this.dumpExistingLayout();
        _previousCustomizableUIState = PrefCalls.getPref("browser.uiCustomization.state");
        _previousTabsInTitlebarState = PrefCalls.getPref("browser.tabs.inTitlebar");

        _selectedAboutDeck = 0;

        get _okButton() {
            return document.getElementById("ok-button");
        }

        get _cancelButton() {
            return document.getElementById("cancel-button");
        }

        get _applyButton() {
            return document.getElementById("apply-button");
        }

        get _viewCreditsButton() {
            return document.getElementById("view-credits-button");
        }

        get _aboutModesDeck() {
            return document.getElementById("aboutModes");
        }

        get _isRestartRequired() {
            for (const option of document.querySelectorAll(".option"))
            {
                if (option.closest("[section-change-requires-restart]") || option.getAttribute("change-requires-restart"))
                {
                    if (option.originalValue != this.getOptionValue(option))
                    {
                        return true;
                    }
                }
            }
            return false;
        }

        getOptionValue(optElm) {
            switch (optElm.dataset.type)
            {
                case "bool":
                    return optElm.checked;
                case "int":
                case "enum":
                    return optElm.value;
                case "string":
                    return optElm.value;
            }

            return null;
        }

        constructor() {
            this._okButton.addEventListener("command", e => this.handleOkApply(e, true));
            this._applyButton.addEventListener("command", e => this.handleOkApply(e, false));
            this._cancelButton.addEventListener("command", this.handleCancel.bind(this));

            for (const option of document.querySelectorAll(".option")) {
                switch (option.dataset.type) {
                    case "bool":
                        option.checked = PrefCalls.getPref(option.dataset.option);
                        break;
                    case "int":
                    case "enum":
                        option.value = PrefCalls.getPref(option.dataset.option);
                        break;
                    case "string":
                        option.value = PrefCalls.getPref(option.dataset.option);
                        break;
                }
                option.originalValue = this.getOptionValue(option);

                switch (option.localName) {
                    case "menulist":
                        option.addEventListener("command", this.refreshViewProperties.bind(this));
                        break;
                    case "checkbox":
                        option.addEventListener("CheckboxStateChange", this.refreshViewProperties.bind(this));
                        break;
                    case "richlistbox":
                        option.addEventListener("select", this.refreshViewProperties.bind(this));
                        break;
                    case "input":
                        option.addEventListener("input", this.refreshViewProperties.bind(this));
                        break;
                }
            }

            for (const expander of document.querySelectorAll(".expanderButton"))
            {
                expander.addEventListener("click", this.toggleExpansion.bind(this));
            }

            for (const listbox of document.querySelectorAll("richlistbox[render-richlistbox]")) {
                this.renderRichlistbox(listbox);
            }

            for (const tab of document.querySelectorAll(".tab"))
            {
                tab.addEventListener("command", this.switchTab.bind(this));
            }

            this.refreshViewProperties();
            this.loadVersion();

            this._viewCreditsButton.hidden = true;
            this._viewCreditsButton.disabled = true;
            this._viewCreditsButton.label = LocaleUtils.str(this.stringbundle, "view_credits_button");

            this._viewCreditsButton.addEventListener("command", this.handleCreditsButton.bind(this));

            document.addEventListener("keypress", this.handleKeyPress);
        }

        handleKeyPress(event) {
            switch (event.key) {
                case "Escape":
                    window.close();
                    break;
            }
        }

        refreshViewProperties(event) {
            let restartRequired = this._isRestartRequired;
            let namorokaStyleLessOrEqual = this.isNamorokaStyleLessOrEqual(1);

            for (const control of document.querySelectorAll("[data-option='Namoroka.Appearance.Aero']")) {
                control.setAttribute("disabled", namorokaStyleLessOrEqual);
            }

            document.querySelector(".restart-required-label").style.display = restartRequired ? "flex" : "none";
        }

        isNamorokaStyleLessOrEqual(value) {
            for (const option of document.querySelectorAll(".option"))
            {
                if (option.closest("[data-option='Namoroka.Appearance.Style']"))
                {
                    let currentValue = this.getOptionValue(option);

                    return Number(currentValue) <= Number(value);
                }
            }
        }
        
        handleOkApply(event, closeWindow = false) {
            let restartRequired = this._isRestartRequired;

            let restartStruct = {
                accepted: false,
                icon: "warning",
                title: LocaleUtils.str(this.stringbundle, "restart_prompt_title"),
                message: LocaleUtils.str(this.stringbundle, "restart_prompt_message"),
                acceptButtonText: LocaleUtils.str(this.stringbundle, "restart_prompt_restart")
            };

            if (restartRequired)
            {
                windowRoot.ownerGlobal.openDialog(
                    "chrome://userchrome/content/windows/common/dialog.xhtml",
                    LocaleUtils.str(this.stringbundle, "restart_prompt_title"),
                    "chrome,centerscreen,resizeable=no,dependent,modal",
                    restartStruct
                );
            }

            if (!restartRequired || restartStruct.accepted)
            {
                for (const option of document.querySelectorAll(".option"))
                {
                    switch (option.dataset.type)
                    {
                        case "bool":
                            PrefCalls.setPref(option.dataset.option, option.checked);
                            break;
                        case "enum":
                            PrefCalls.setPref(option.dataset.option, Number(option.value));
                            break;
                        case "int":
                            PrefCalls.setPref(option.dataset.option, Math.floor(Number(option.value)));
                            break;
                        case "string":
                            PrefCalls.setPref(option.dataset.option, option.value);
                            break;
                    }
                }

                if (restartRequired)
                    this.restartApplication(true);

                if (closeWindow)
                    window.close();   
            }
        }

        handleCancel(event) {
            if (event.type !== "command")
                return

            window.close();
        }

        toggleExpansion(event) 
        {
            if (event.button !== 0)
                return;

            let carat = e.target;
            carat.closest(".expander").classList.toggle("expanded");
        }

        renderRichlistbox(listbox) {
            let items = listbox.querySelectorAll("richlistitem");

            let fragment = window.MozXULElement.parseXULToFragment(`
                <hbox flex="1">
                    <vbox>
                        <image class="styleIcon" />
                    </vbox>
                    <vbox flex="1">
                        <label class="styleName"></label>
                        <description class="styleDescription"></description>
                    </vbox>
                </hbox>
            `).firstChild;

            let styleIcon = fragment.querySelector(".styleIcon");
            let styleName = fragment.querySelector(".styleName");
            let styleDescription = fragment.querySelector(".styleDescription");

            listbox.removeAttribute("render-richlistbox");

            items.forEach(item => {
                let iconURL = item.getAttribute("iconURL");
                let name = item.getAttribute("name") || "";
                let description = item.getAttribute("description");

                styleIcon.src = iconURL;
                styleName.value = name;
                styleDescription.hidden = !description;
                styleDescription.value = !description ? "" : description;

                item.appendChild(fragment.cloneNode(true));
            });

            listbox.addEventListener("select", this.setPreviewImage.bind(this));
            this.setPreviewImage({ target: listbox });
        }

        setPreviewImage(event) {
            let listbox = event.target;
            let selectedItem = listbox.selectedItem;

            let previewImageContainer = listbox.nextElementSibling;
            if (!previewImageContainer || !previewImageContainer.matches(`#listboxPreview[controls="${listbox.id}"]`))
                return;

            previewImageContainer.querySelector("image").src = selectedItem.getAttribute("previewImage");
        }

        switchTab(event) {
            let tab = event.target;
            let id = tab.id.replace("tab-", "");

            /* Update tabs */
            document.querySelector(".tab-selected").classList.remove("tab-selected");
            tab.classList.add("tab-selected");

            /* Update sections */
            document.querySelector(".section-selected").classList.remove("section-selected");
            document.getElementById(`section-${id}`).classList.add("section-selected");

            /* Update content element */
            document.getElementById("content").dataset.tab = id;

            this._viewCreditsButton.hidden = (id == "about") ? false : true;
            this._viewCreditsButton.disabled = (id == "about") ? false : true;
        }

        restartApplication(clearCache) {
            clearCache && Services.appinfo.invalidateCachesOnRestart();
            let cancelQuit = Cc["@mozilla.org/supports-PRBool;1"].createInstance(Ci.nsISupportsPRBool);
            Services.obs.notifyObservers(
                cancelQuit,
                "quit-application-requested",
                "restart"
            );
            if (!cancelQuit.data) {
                Services.startup.quit(
                    Services.startup.eAttemptQuit | Services.startup.eRestart
                );
                return true
            }
            return false
        }

        async loadVersion() {
            let localNamorokaJSON = await NamorokaUpdateChecker.getBuildData("local");

            document.querySelectorAll("#version").forEach(async identifier => {
                if (identifier.getAttribute("numberonly")) {
                    identifier.value = localNamorokaJSON.version;
                }
                else {
                    identifier.value = LocaleUtils.str(this.stringbundle, "version_format", localNamorokaJSON.version);
                }
            });

            document.querySelectorAll("#build").forEach(async identifier => {
                if (identifier.getAttribute("numberonly")) {
                    if (identifier.getAttribute("includehash")) {
                        identifier.value = `${localNamorokaJSON.build} (${localNamorokaJSON.hash})`
                    }
                    else {
                        identifier.value = localNamorokaJSON.build;
                    }
                }
                else {
                    identifier.value = LocaleUtils.str(this.stringbundle, "build_format", localNamorokaJSON.build);
                }
            });

            document.querySelectorAll("#channel").forEach(async identifier => {
                identifier.value = localNamorokaJSON.branch;
            });

            for (const aboutSection of document.querySelectorAll(".service-info")) {
                switch (aboutSection.id) {
                    case "browserName":
                        aboutSection.value = Services.appinfo.name;
                        break;
                    case "browserVersion":
                        aboutSection.value = Services.appinfo.version;
                        break;
                    case "browserChannel":
                        aboutSection.value = Services.appinfo.defaultUpdateChannel;
                        break;
                }
            }
        }

        dumpExistingLayout() {
            let out = {};

            for (let area in NamorokaLayoutTemplateManager.TOOLBAR_LAYOUT_TEMPLATE) {
                let widgetIds = CustomizableUI.getWidgetIdsInArea(area);
                out[area] = [];

                for (let id of widgetIds) {
                    if (NamorokaLayoutTemplateManager.SPECIAL_WIDGET_TYPES.some(type => id.startsWith("customizableui-special-" + type))) {
                        let type = id.replace(/^customizableui-special-/, "").replace(/\d+$/, "");
                        out[area].push({ type });
                    } else {
                        out[area].push({ id });
                    }
                }
            }

            return out;
        }

        handleCreditsButton(event) {
            let viewCreditsButton = event.target;
            let currentPage = document.querySelector(".section-selected");

            if (event.type !== "command" || currentPage.id != "section-about")
                return;

            this._selectedAboutDeck = this._aboutModesDeck.selectedIndex == 0 ? 1 : 0;
            viewCreditsButton.label = this._selectedAboutDeck == 0 ? LocaleUtils.str(this.stringbundle, "view_credits_button") : LocaleUtils.str(this.stringbundle, "view_about_button");
            
            this._aboutModesDeck.selectedIndex = this._selectedAboutDeck;
        }
    }

    window.addEventListener("DOMContentLoaded", () => {
        g_NamorokaOptionsDialog = new NamorokaOptionsDialog();
    });
}