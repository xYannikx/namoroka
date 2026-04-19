// ==UserScript==
// @name			 Namoroka :: Wizard
// @description 	 Opens the Namoroka Wizard on first-time installs
// @author			 travy-patty
// @github           https://github.com/travy-patty
// @include			 main
// @backgroundmodule
// ==/UserScript==

var { PrefCalls } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
const NAMOROKA_FIRST_RUN_PREF = "Namoroka.Parameter.FirstRun";

export function openNamorokaWizardDialog(verifyFirstRun = true) {
    if (verifyFirstRun) {
        let isFirstRun = PrefCalls.getPref(NAMOROKA_FIRST_RUN_PREF);

        if (!isFirstRun) {
            launchNamorokaWizard.call(this);
        }
    }
    else {
        launchNamorokaWizard.call(this);
    }
}

function launchNamorokaWizard() {
    PrefCalls.setPref(NAMOROKA_FIRST_RUN_PREF, false);

    this.window.openDialog(
        "chrome://userchrome/content/windows/wizard/wizard.xhtml",
        "Set Up Namoroka",
        "chrome,centerscreen,resizable=no,dependent"
    );
}