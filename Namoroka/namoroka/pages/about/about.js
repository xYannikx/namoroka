var g_NamorokaAboutPage;

{
    var { BrandUtils, LocaleUtils, PrefCalls, NamorokaInfo } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    const NAMOROKA_APPEARANCE_STYLE_PREF = "Namoroka.Appearance.Style";

    ChromeUtils.defineESModuleGetters(window, {
        NamorokaThemeManager: "chrome://modules/content/NamorokaThemeManager.sys.mjs"
    });
    
    let g_themeManager = new NamorokaThemeManager(
        document.documentElement,
        {
            style: true,
        }
    );

    class NamorokaAboutPage {
        _stringbundle = document.getElementById("namorokaAboutBundle");
        _fragment = null;

        get fragmentOld() {
            return `
                <html:div id="mozinfo">
                    <html:a href="http://www.mozilla.org/">
                        <html:img src="about:logo" />
                    </html:a>
                    <html:h1>
                        <html:a id="mozlink" href="http://www.mozilla.org/">${BrandUtils.getBrandingKey("brandShortName")} ${NamorokaInfo.versionTextInfo()[PrefCalls.getPref(NAMOROKA_APPEARANCE_STYLE_PREF)]?.version}</html:a>
                    </html:h1>
                    ${NamorokaInfo.populateUserAgentString()}
                </html:div>
                <html:hr />
                <html:ul>
                    <html:li>
                        Copyright &#xa9; 1998-2005 ${this._stringbundle.getString("license.part1")} <html:a href="about:credits">${this._stringbundle.getString("license.contrib")}</html:a> ${this._stringbundle.getString("license.part2")} <html:a href="about:license#mpl">Mozilla Public License</html:a> ${this._stringbundle.getString("license.and")} <html:a href="https://www-archive.mozilla.org/mpl/npl-1.1">Netscape Public License</html:a> ${this._stringbundle.getString("license.part3")}
                    </html:li>
                    <html:li>
                        Portions of this software are copyright &#xa9; 1994 The Regents of the University of California.  All Rights Reserved.
                    </html:li>
                    <html:li>This software may contain portions that are copyright &#xa9; 1998-2002 
                        <html:a href="http://www.supportsoft.com/">SupportSoft, Inc.</html:a>  All Rights Reserved.
                    </html:li>
                </html:ul>
                <html:p>
                U.S. GOVERNMENT END USERS. The Software is a &#x22;commercial
                item,&#x22; as that term is defined in 48 C.F.R. 2.101 (Oct. 1995), consisting
                of &#x22;commercial computer software&#x22; and &#x22;commercial computer software 
                documentation,&#x22; as such terms are used in 48 C.F.R. 12.212 (Sept. 1995). 
                Consistent with 48 C.F.R. 12.212 and 48 C.F.R. 227.7202-1 through 227.7202-4
                (June 1995), all U.S. Government End Users acquire the Software with only 
                those rights set forth herein.
                </html:p>
            `;
        }

        get fragmentNew() {
            return `
                <html:div id="aboutPageContainer">
                    <html:div id="aboutLogoContainer">
                        <html:a href="http://www.mozilla.org/" style="text-decoration: none;">
                            <html:img src="about:logo" alt="${BrandUtils.getBrandingKey("brandShortName")}" />
                            <html:p id="version">${this._stringbundle.getString("about.version")} ${NamorokaInfo.versionTextInfo()[PrefCalls.getPref(NAMOROKA_APPEARANCE_STYLE_PREF)]?.version}</html:p>
                        </html:a>
                    </html:div>

                    <html:ul id="aboutPageList">
                        <html:li>${this._stringbundle.getFormattedString("about.copy.beforeLink", [NamorokaInfo.versionTextInfo()[PrefCalls.getPref(NAMOROKA_APPEARANCE_STYLE_PREF)]?.copyright])} <html:a href="about:credits">${this._stringbundle.getString("about.copy.linkTitle")}</html:a> ${this._stringbundle.getString("about.copy.afterLink")}</html:li>
                        <html:li>${this._stringbundle.getString("about.license.beforeLink")} <html:a href="about:license">${this._stringbundle.getString("about.license.linkTitle")}</html:a> ${this._stringbundle.getString("about.license.afterLink")}</html:li>
                        <html:li>${this._stringbundle.getString("about.relnotes.beforeLink")} <html:a id="releaseNotesURL" href="">${this._stringbundle.getString("about.relnotes.linkTitle")}</html:a>
                        ${this._stringbundle.getString("about.relnotes.afterLink")}</html:li>
                        <html:li>${this._stringbundle.getString("about.buildconfig.beforeLink")} <html:a href="about:buildconfig">${this._stringbundle.getString("about.buildconfig.linkTitle")}</html:a>
                        ${this._stringbundle.getString("about.buildconfig.afterLink")}</html:li>
                        <html:li>${this._stringbundle.getString("about.buildIdentifier")} ${NamorokaInfo.populateUserAgentString()}</html:li>
                    </html:ul>

                </html:div>
            `;
        }

        init() {
            let fragment = (PrefCalls.getPref(NAMOROKA_APPEARANCE_STYLE_PREF) != 0 ? this.fragmentNew : this.fragmentOld);
            this._fragment = fragment;

            document.body.appendChild(window.MozXULElement.parseXULToFragment(this._fragment));
        }
    }
    
    window.addEventListener("DOMContentLoaded", () => {
        g_NamorokaAboutPage = new NamorokaAboutPage();
        g_NamorokaAboutPage.init();
    });
}