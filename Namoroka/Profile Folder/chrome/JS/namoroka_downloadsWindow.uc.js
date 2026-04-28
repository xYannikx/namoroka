// ==UserScript==
// @name			Namoroka :: Downloads Window
// @description 	Adds styling and elements for the Downloads window.
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript===

BrowserCommands.downloadsUI = function downloadsUI() {
    openDialog(
        "about:downloads",
        "",
        "chrome, toolbar=no, dialog=no, resizable",
        "Downloads"
    );
}