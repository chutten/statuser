// emit events on the panel's port for corresponding actions
var countThreadHangs = document.getElementById("countThreadHangs");
var countEventLoopLags = document.getElementById("countEventLoopLags");
countThreadHangs.addEventListener("click", function() {
  self.port.emit("mode-changed", "threadHangs");
});
countEventLoopLags.addEventListener("click", function() {
  self.port.emit("mode-changed", "eventLoopLags");
});
var playSound = document.getElementById("playSound");
playSound.addEventListener("change", function(event) {
  self.port.emit("play-sound-changed", event.target.checked);
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

// listen to re-emitted show event from main script
self.port.on("show", function(currentSettings) {
  // populate the settings dialog with the current value of the settings
  playSound.checked = currentSettings.playSound;
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
      banner.innerHTML = "BACKGROUND HANG REPORTING <a href=\"about:telemetry\" target=\"_blank\">UNAVAILABLE</a>";
      banner.style.display = "block";
      break;
    default:
      banner.style.display = "none";
  }
});

// trimmed and normalized blip sound from https://commons.wikimedia.org/wiki/File:Blip.ogg
// available under public domain
var blipSound = new Audio("blip.ogg");
self.port.on("blip", function() {
  if (playSound.checked) {
    // play the blip sound
    blipSound.currentTime = 0;
    blipSound.play();
  }
});
