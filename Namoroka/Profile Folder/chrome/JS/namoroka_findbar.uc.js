// ==UserScript==
// @name			Namoroka :: Findbar
// @description 	Adds styling attributes for the findbar
// @author			travy-patty
// @github          https://github.com/travy-patty
// @include			main
// ==/UserScript==

var g_namorokaFindbar;

{
    var { waitForElement } = ChromeUtils.importESModule("chrome://modules/content/NamorokaUtils.sys.mjs");
    waitForElement = waitForElement.bind(window);

    class NamorokaFindbar {
        _init(findbarNode) {
            console.log(findbarNode);

            _addToolbarButtonLabels(findbarNode);
        }
        
        onMutation(list, observer) {
            for (const mut of list)
            {
                if (mut.type == "childList") 
                {
                    for (const newNode of mut.addedNodes) 
                    {
                        if (newNode.nodeName == "findbar") 
                        {
                            this._init(newNode);

                            observer.disconnect();
                        }
                    }
                }
            }
        }

        _addToolbarButtonLabels(aNode) {
            console.log(aNode);
        }
    }

    g_namorokaFindbar = new NamorokaFindbar;

    waitForElement(".browserContainer").then(e => {
        let observer = new MutationObserver(g_namorokaFindbar.onMutation);
        observer.observe(
            e, 
            { 
                childList: true 
            }
        );
    });
}