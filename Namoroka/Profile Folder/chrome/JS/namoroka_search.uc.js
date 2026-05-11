// ==UserScript==
// @name			Namoroka :: Search
// @description 	Restore old icons for search engines, and a class for a focused searchbox.
// @author			aubymori
// @include			main
// ==/UserScript==

var g_NamorokaSearchManager;

{
	var { LocaleUtils, waitForElement, renderElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);
    renderElement = renderElement.bind(window);

    let menusBundle = "chrome://namoroka/locale/properties/menus.properties";

	class NamorokaSearchManager
	{
		REPLACEMENTS = {
			"google": "chrome://namoroka/skin/searchplugins/google.ico",
			"ebay": "chrome://namoroka/skin/searchplugins/ebay.ico",
			"wikipedia": "chrome://namoroka/skin/searchplugins/wikipedia.ico",
			"amazon": "chrome://namoroka/skin/searchplugins/amazon.ico",
			"yahoo": "chrome://namoroka/skin/searchplugins/yahoo.ico",
			"bing": "chrome://namoroka/skin/searchplugins/bing.ico",
		};

        async updateSearchBox()
		{
			let engine = await Services.search.getDefault();
            let id = engine.id;

			let icon = await waitForElement(".searchbar-search-icon");
			icon.setAttribute("src", await this.getReplacementIcon(id));

			let textbox = await waitForElement(".searchbar-textbox");
			textbox.placeholder = engine._name;
		}

        async getReplacementIcon(engineId) {
			let replacements = this.REPLACEMENTS;

            if (engineId in replacements) {
                return replacements[engineId];
            }

            let iconURL = (await Services.search.getEngineById(engineId))?.getIconURL();

            return iconURL;
        }
        
		updateDisplay_hook()
		{
			if (this.updateDisplay_orig && this.searchbar)
			{
				this.updateDisplay_orig.call(this.searchbar);
			}
			this.updateSearchBox();
		}

		onFocusSearchbar(event)
		{
			if (event.target.classList.contains("searchbar-textbox"))
			{
				event.target.parentNode.classList.add("focus");
			}	
		}

		onUnfocusSearchbar(event)
		{
			if (event.target.classList.contains("searchbar-textbox"))
			{
				event.target.parentNode.classList.remove("focus");
			}	
		}

        async searchBarSearchButton()
		{
			let searchButton = await waitForElement(".searchbar-search-button");

			if (!searchButton.querySelector("menupopup")) {
				let menupopup = MozXULElement.parseXULToFragment(`
					<menupopup id="searchbar-popup" class="searchbar-popup" position="after_start">
						<menuseparator/>
						<menuitem id="open-engine-manager" class="open-engine-manager" label="${LocaleUtils.str(menusBundle, "namoroka_enginemanager_label")}" accesskey="${LocaleUtils.str(menusBundle, "namoroka_enginemanager_accesskey")}" />
					</menupopup>
				`);

                let engineManagerElem = menupopup.querySelector("#open-engine-manager");
                engineManagerElem.addEventListener("command", (e) => {
                    openPreferences("paneSearch");
                })

				searchButton.appendChild(menupopup);

                searchButton.addEventListener("mousedown", this.handleSearchButtonClick.bind(this));
			}
			if (!searchButton.querySelector(".searchbar-engine-button-stack")) {
				let stackFragment = renderElement("xul:stack", {
					class: "searchbar-engine-button-stack",
				},
				[
					renderElement("xul:vbox", {flex: "1"}, [
						renderElement("xul:image", {
							class: "searchbar-engine-button-top searchbar-engine-button-bkgnd",
						}),
						renderElement("xul:image", {
							flex: "1",
							class: "searchbar-engine-button-mid-top searchbar-engine-button-bkgnd",
						}),
						renderElement("xul:image", {
							flex: "1",
							class: "searchbar-engine-button-mid-bottom searchbar-engine-button-bkgnd",
						}),
						renderElement("xul:image", {
							class: "searchbar-engine-button-bottom searchbar-engine-button-bkgnd",
						}),
					]),
					renderElement("xul:hbox", {
						align: "center",
						class: "searchbar-engine-image-container",
					})
				]);

				searchButton.appendChild(stackFragment);

				let searchIcon = await waitForElement(".searchbar-search-icon");
				let searchIconOverlay = await waitForElement(".searchbar-search-icon-overlay");
				let searchEngineImageContainer = await waitForElement(".searchbar-engine-image-container");

				searchEngineImageContainer.appendChild(searchIcon);
				searchEngineImageContainer.appendChild(searchIconOverlay);
			}
		}

        handleSearchButtonClick(event) {
            event.stopPropagation();
            event.preventDefault();

            this.buildSearchEngineMenu();

            let searchButton = event.currentTarget;
            searchButton.querySelector("menupopup").openPopup(searchButton, "after_start");   
        }

		async buildSearchEngineMenu() 
		{
			let menupopup = await waitForElement("#searchbar-popup");

            let items = menupopup.querySelectorAll(".addengine-item");
            for (let addengineItem of items) {
                addengineItem.remove();
            }

			await Services.search.init();

			let visibleEngines = await Services.search.getVisibleEngines();
			if (visibleEngines.length > 0) {
				for (let engine of visibleEngines) {					
                    let defaultEngine = await Services.search.getDefault();

                    let menuitem = MozXULElement.parseXULToFragment(`
						<menuitem class="menuitem-iconic addengine-item"
								  label="${engine._name}" 
								  image="${await this.getReplacementIcon(engine.id)}"
								  tooltiptext="${LocaleUtils.str(menusBundle, "namoroka_addengineItem_tooltip", engine._name)}"
						/>
					`).firstChild;
                    
                    if (defaultEngine.id == engine.id) {
                        menuitem.setAttribute("default", "true");
                    }

                    menuitem.addEventListener("command", (e) => {
                        Services.search.setDefault(Services.search.getEngineById(engine.id), Ci.nsISearchService.CHANGE_REASON_USER_SEARCHBAR);
                    })

					menupopup.insertBefore(menuitem, menupopup.querySelector("menuseparator"));
				}
			}
		}

        async installSearchBoxHook()
		{
			let searchbar = await waitForElement("#searchbar");
			let toolboxRoot = await waitForElement("#navigator-toolbox");

			this.searchbar = searchbar;
			this.updateDisplay_orig = searchbar.updateDisplay;
			searchbar.updateDisplay = this.updateDisplay_hook.bind(this);
			
			document.addEventListener("focusin", this.onFocusSearchbar.bind(this));
			document.addEventListener("focusout", this.onUnfocusSearchbar.bind(this));

			this.searchBarSearchButton();

			toolboxRoot.addEventListener("customizationchange", this.searchBarSearchButton.bind(this));
			toolboxRoot.addEventListener("aftercustomization", this.searchBarSearchButton.bind(this));
		}
	}

    g_NamorokaSearchManager = new NamorokaSearchManager;
    g_NamorokaSearchManager.installSearchBoxHook();
}