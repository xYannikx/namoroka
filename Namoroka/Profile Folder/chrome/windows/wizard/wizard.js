var g_NamorokaWizardDialog;

const NAMOROKA_FIRST_RUN_PREF = "Namoroka.Parameter.FirstRun";
const NAMOROKA_APPEARANCE_STYLE_PREF = "Namoroka.Appearance.Style";

{
    var { LocaleUtils, PrefCalls, WindowIconUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");

    ChromeUtils.defineESModuleGetters(window, {
        CustomizableUI: "resource:///modules/CustomizableUI.sys.mjs",
        NamorokaLayoutTemplateManager: "chrome://modules/content/NamorokaLayoutTemplateManager.sys.mjs"
    });

    class NamorokaWizardDialog {
        _stringbundle = null;
        _selectedIndex = null;
        _selectedNode = null;
        _pageStack = [];
        _previousCustomizableUILayout = this.dumpExistingLayout();
        _previousCustomizableUIState = PrefCalls.getPref("browser.uiCustomization.state");
        _previousTabsInTitlebarState = PrefCalls.getPref("browser.tabs.inTitlebar");

        get stringbundle() {
            if (!this._stringbundle) {
                this._stringbundle = document.getElementById("namorokaWizardBundle");
            }
            return this._stringbundle;
        }

        get _pageDeck() {
            return document.getElementById("pages");
        }

        get _backButton() {
            return document.getElementById("back-button");
        }

        get _nextButton() {
            return document.getElementById("next-button");
        }

        get _styleList() {
            return document.getElementById("styleList");
        }
        
        get _previewImage() {
            return document.getElementById("previewImage");
        }

        get _resetLayout() {
            return document.getElementById("reset-layout");
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

        init() {
            this._selectedNode = document.querySelector(`[data-page-id="welcome"]`);

            this._pageStack.push("welcome");

            this._backButton.disabled = true;
            this._backButton.addEventListener("command", this.goBack.bind(this));

            this._nextButton.addEventListener("command", (e) => {
                if (this._selectedNode.dataset.pageNext && this._selectedNode.dataset.pageId !== "finish") {
                    this.showPage(this._selectedNode.dataset.pageNext);
                }
                else {
                    this.handleFinishButton(e);
                }
            });

            this.renderStyleList();
            this.setPreview();

            NamorokaLayoutTemplateManager.applyDefaultLayout(window.opener);
            PrefCalls.setPref("browser.uiCustomization.state");
            PrefCalls.setPref(NAMOROKA_APPEARANCE_STYLE_PREF, 0);

            this._resetLayout.addEventListener("CheckboxStateChange", this.handleResetLayout.bind(this));

            this.setDialogIcon();
        }

        handleResetLayout(event) {
            let checked = event.target.checked;
            
            if (checked) {
                NamorokaLayoutTemplateManager.applyDefaultLayout(window.opener);
                PrefCalls.setPref("browser.uiCustomization.state");
            }
            else if (this._previousCustomizableUILayout) {
                NamorokaLayoutTemplateManager.applyLayout(window.opener, this._previousCustomizableUILayout);
                PrefCalls.setPref("browser.uiCustomization.state");
                PrefCalls.setPref("browser.tabs.inTitlebar", this._previousTabsInTitlebarState);
            }
        }

        showPage(pageId, pushToStack = true) {
            let pageIdElement = document.querySelector(`[data-page-id="${pageId}"]`);

            let pageIndex = Array.from(this._pageDeck.children).indexOf(pageIdElement);

            if (pageIdElement) {
                if (pageIndex !== -1) {
                    this._selectedNode = pageIdElement;
                    this._pageDeck.selectedIndex = pageIndex;
                    this._selectedIndex = pageId;

                    if (pushToStack) {
                        this._pageStack.push(pageId);
                    }
                }
            }
            else {
                console.error('Page not found: ' + pageId);
            }

            if (pageId == "welcome") {
                this._backButton.disabled = true;
            } else {
                this._backButton.disabled = false;
            }

            if (pageId == "finish") {
                this.finishPage();
            }
            else {
                this._nextButton.label = this.stringbundle.getString("wizard_next");   
            }
        }

        goBack(event) {
            if (this._pageStack.length <= 1)
                return

            this._pageStack.pop();
            this.showPage(this._pageStack[this._pageStack.length - 1], false);
        }

        renderStyleList() {
            let richlistitems = this._styleList.querySelectorAll("richlistitem");

            let richlistitemFragment = window.MozXULElement.parseXULToFragment(`
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

            let styleIcon = richlistitemFragment.querySelector(".styleIcon");
            let styleName = richlistitemFragment.querySelector(".styleName");
            let styleDescription = richlistitemFragment.querySelector(".styleDescription");
            
            richlistitems.forEach(richlistitem => {
                styleIcon.src = richlistitem.getAttribute("iconURL");
                styleName.value = richlistitem.getAttribute("name");
                styleDescription.value = richlistitem.getAttribute("description");

                richlistitem.appendChild(richlistitemFragment.cloneNode(true));
            });

            this._styleList.addEventListener("select", this.setPreview.bind(this));
        }

        setPreview(event) {
            // Change the preview image on the wizard
            if (!this._styleList.selectedItem)
                return;

            let previewImage = this._styleList.selectedItem.getAttribute("previewImage");
            this._previewImage.src = previewImage;

            // Preview the selected style by changing the style
            if (this._selectedIndex == "appearance") {
                PrefCalls.setPref(NAMOROKA_APPEARANCE_STYLE_PREF, parseInt(this._styleList.selectedItem.value, 10));

                if (this._resetLayout.checked) {
                    NamorokaLayoutTemplateManager.applyLayout(window.opener);
                }
            }
        }

        finishPage() {
            this._nextButton.label = this._stringbundle.getString("wizard_finish");   
        }

        handleFinishButton(event) {
            if (event.type == "command") {
                let restartBrowser = document.getElementById("restart-browser").checked;
                let resetLayout = document.getElementById("reset-layout").checked;

                PrefCalls.setPref(NAMOROKA_FIRST_RUN_PREF, true);

                if (resetLayout) {
                    NamorokaLayoutTemplateManager.applyLayout(window.opener);
                }

                if (restartBrowser) {
                    this.restartApplication(true);
                }
                else {
                    window.close();
                }
            }
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

        async setDialogIcon() {
            await WindowIconUtils.setDialogIcon(
                window,
                "chrome://userchrome/content/branding/namoroka/content/icon16.png",
                "chrome://userchrome/content/branding/namoroka/content/icon32.png"
            );
        }
    }
    
    window.addEventListener("DOMContentLoaded", () => {
        g_NamorokaWizardDialog = new NamorokaWizardDialog();
        g_NamorokaWizardDialog.init();
    });
}