const { LocaleUtils, 
        PrefCalls, 
        BrandUtils } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
        
ChromeUtils.defineESModuleGetters(window, {
    NamorokaThemeManager: "chrome://modules/content/NamorokaThemeManager.sys.mjs",
    NamorokaUpdateChecker: "chrome://modules/content/NamorokaUpdateChecker.sys.mjs",
});

const gOptionsBundle = "chrome://namoroka/locale/properties/namoroka-options.properties";

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

// snatched from fx-autoconfig
function restartApplication(clearCache) {
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

document.querySelectorAll("richlistbox").forEach(listbox => {
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
});

function setPreviewImage(aEvent) {
    let listbox = aEvent.currentTarget;
    let selectedItem = listbox.selectedItem;

    let previewImageContainer = listbox.nextElementSibling;
    if (!previewImageContainer || !previewImageContainer.matches(`#listboxPreview[controls="${listbox.id}"]`))
        return;

    previewImageContainer.querySelector("image").src = selectedItem.getAttribute("previewImage");
}

function refreshViewProperties()
{
    // Handle local display changes when the user changes configuration.
    let restartRequired = isRestartRequired();

    document.querySelector(".restart-required-label").style.display = restartRequired ? "flex" : "none";

    let didOptionChange = didOptionChange();

    document.getElementById("apply-button").disabled = !didOptionChange;
}


/* Fill current values */
for (const option of document.querySelectorAll(".option"))
{
    switch (option.dataset.type)
    {
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

    if (option.localName == "menulist")
        option.addEventListener("command", refreshViewProperties);
    else if (option.localName == "checkbox")
        option.addEventListener("CheckboxStateChange", refreshViewProperties);
    else if (option.localName == "richlistbox")
        option.addEventListener("select", refreshViewProperties);
    else if (option.localName == "input")
        option.addEventListener("input", refreshViewProperties);
}

refreshViewProperties();

function getOptionValue(optElm)
{
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

function isRestartRequired()
{
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

function okApplyHandler(e, closeWindow = false)
{
    let restartRequired = isRestartRequired();

    let restartStruct = {
        accepted: false,
        icon: "warning",
        title: LocaleUtils.str(gOptionsBundle, "restart_prompt_title"),
        message: LocaleUtils.str(gOptionsBundle, "restart_prompt_message"),
        acceptButtonText: LocaleUtils.str(gOptionsBundle, "restart_prompt_restart")
    };

    if (restartRequired)
    {
        windowRoot.ownerGlobal.openDialog(
            "chrome://userchrome/content/windows/common/dialog.xhtml",
            LocaleUtils.str(gOptionsBundle, "restart_prompt_title"),
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
            restartApplication(true);

        if (closeWindow)
            window.close();
    }
}

/* Events */
document.getElementById("ok-button").addEventListener("click", e => okApplyHandler(e, true));
document.getElementById("apply-button").addEventListener("click", e => okApplyHandler(e, false));

document.getElementById("cancel-button").addEventListener("click", function()
{
    window.close();
});	


/* Expanders */
function toggleExpansion(e) 
{
	let carat = e.target;
	carat.closest(".expander").classList.toggle("expanded");
}

for (const expander of document.querySelectorAll(".expanderButton"))
{
	expander.addEventListener("click", this.toggleExpansion);
}

/* Tabs */
function switchTab(e)
{
    let id = this.id.replace("tab-", "");

    /* Update tabs */
    document.querySelector(".tab-selected").classList.remove("tab-selected");
    this.classList.add("tab-selected");

    /* Update sections */
    document.querySelector(".section-selected").classList.remove("section-selected");
    document.getElementById(`section-${id}`).classList.add("section-selected");

    /* Update content element */
    document.getElementById("content").dataset.tab = id;
}

for (const tab of document.querySelectorAll(".tab"))
{
    tab.addEventListener("click", switchTab);
}

/* Keyboard Events */
document.documentElement.addEventListener('keypress', function(e) {
	if (e.key == "Escape") {
		window.close();
	}
});

/* About Page */

async function loadVersion() {
    let localNamorokaJSON = await NamorokaUpdateChecker.getBuildData("local");

    document.querySelectorAll("#version").forEach(async identifier => {
        if (identifier.getAttribute("numberonly")) {
            identifier.value = localNamorokaJSON.version;
        }
        else {
            identifier.value = LocaleUtils.str(gOptionsBundle, "version_format", localNamorokaJSON.version);
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
            identifier.value = LocaleUtils.str(gOptionsBundle, "build_format", localNamorokaJSON.build);
        }
	});

    document.querySelectorAll("#channel").forEach(async identifier => {
        identifier.value = localNamorokaJSON.branch;
	});

    for (const aboutSection of document.querySelectorAll("label[data-content]"))
    {
        aboutSection.value = eval(aboutSection.dataset.content);
    }
}

document.addEventListener("DOMContentLoaded", loadVersion);