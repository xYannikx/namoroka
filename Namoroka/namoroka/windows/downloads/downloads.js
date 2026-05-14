async function onDownloadShowFolder(event) {
    Downloads.getPreferredDownloadsDirectory().then(downloadsDir => {
        if (downloadsDir) {
            try {
                const file = Components.classes["@mozilla.org/file/local;1"]
                    .createInstance(Components.interfaces.nsIFile);
                file.initWithPath(downloadsDir);
                file.launch();
            } catch (error) {
                console.error("Error opening downloads folder: ", error);
                alert("Error opening downloads folder.");
            }
        } else {
            alert("Preferred downloads folder not found.");
        }
    });
}

document.getElementById("saveToFolder").addEventListener("command", onDownloadShowFolder);

Downloads.getPreferredDownloadsDirectory().then(a => {
    document.querySelector("#saveToFolder").setAttribute("image", `moz-icon:file:///${a.replaceAll("\\", "/")}/?size=16`);
    document.querySelector("#saveToFolder").setAttribute("label", ""+a.replace(/^.*[\\/]/, '')+"");
});