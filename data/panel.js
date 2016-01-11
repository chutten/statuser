// emit events on the panel's port for corresponding actions
var countThreadHangs = document.getElementById("countThreadHangs");
var countEventLoopHangs = document.getElementById("countEventLoopHangs");
countThreadHangs.addEventListener("click", function() {
    self.port.emit("mode-changed", "threadHangs");
});
countEventLoopHangs.addEventListener("click", function() {
    self.port.emit("mode-changed", "eventLoopHangs");
});
var hangThreshold = document.getElementById("hangThreshold");
hangThreshold.addEventListener("input", function() {
    var value = parseInt(hangThreshold.value);
    if (!isNaN(value)) {
        self.port.emit("hang-threshold-changed", value);
    }
});
var clearCount = document.getElementById("clearCount");
clearCount.addEventListener("click", function() {
    self.port.emit("clear-count");
});

// listen to re-emitted show event from main script
self.port.on("show", function(currentSettings) {
    // populate the settings dialog with the current value of the settings
    document.getElementById("hangThreshold").value = currentSettings.hangThreshold;
});
