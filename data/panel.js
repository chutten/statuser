// emit events on the panel's port for corresponding actions
var countThreadHangs = document.getElementById("countThreadHangs");
var countEventLoopLags = document.getElementById("countEventLoopLags");
countThreadHangs.addEventListener("click", function() {
  self.port.emit("mode-changed", "threadHangs");
});
countEventLoopLags.addEventListener("click", function() {
  self.port.emit("mode-changed", "eventLoopLags");
});
var hangThreshold = document.getElementById("hangThreshold");
hangThreshold.addEventListener("change", function(event) {
  var value = parseInt(event.target.value);
  if (!isNaN(value)) {
    self.port.emit("hang-threshold-changed", value);
  }
});
document.getElementById("clearCount").addEventListener("click", function() {
  self.port.emit("clear-count");
});

// open external links in a new tab
function setExternalLinks() {
  var links = document.getElementsByClassName("external-link");
  for (var i = 0; i < links.length; i ++) {
    links[i].onclick = function (event) {
      if (typeof event.target.href === "string") {
        self.port.emit("open-link", event.target.href);
      }
      event.preventDefault();
    };
  }
}

// listen to re-emitted show event from main script
self.port.on("show", function(currentSettings) {
  // populate the settings dialog with the current value of the settings
  document.getElementById("hangThreshold").value = currentSettings.hangThreshold;
  switch (currentSettings.mode) {
    case "threadHangs":
      document.getElementById("countThreadHangs").checked = true;
      break;
    case "eventLoopLags":
      document.getElementById("countEventLoopLags").checked = true;
      break;
    default:
      console.warn("Unknown mode: ", currentSettings.mode);
  }
});

// process warning messages
self.port.on("warning", function(warningType) {
  var banner = document.getElementById("warningBanner");
  switch (warningType) {
    case "unavailableBHR":
      banner.innerHTML = "<a href=\"about:telemetry\" class=\"external-link\">UNAVAILABLE</a>";
      setExternalLinks(); // ensure that external links in the banner work properly
      banner.style.display = "block";
      break;
    default:
      banner.style.display = "none";
  }
});
