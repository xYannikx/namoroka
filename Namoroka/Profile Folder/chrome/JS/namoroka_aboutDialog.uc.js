// ==UserScript==
// @name			Namoroka :: About Dialog
// @description 	Replaces normal About Firefox dialog with a custom one
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

window.openAboutDialog = function openAboutDialog()
{
    window.openDialog(
        "chrome://userchrome/content/windows/aboutDialog/aboutDialog.xhtml",
        "",
        "chrome,centerscreen,resizeable=no,dependent"
    ); 
}