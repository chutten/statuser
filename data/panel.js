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
  hangThreshold.value = currentSettings.hangThreshold;
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

self.port.on("set-hangs", function(hangStacks) {
  var hangs = document.getElementById("hangStacks");
  hangs.innerHTML = ""; // clear the contents of the hang stacks list
  hangStacks.reverse().forEach((hangStack, i) => {
    // create an entry for the hang stack
    var entry = document.createElement("div");
    var copyButton = document.createElement("button");
    copyButton.innerHTML = '<img src="copy-icon.svg" />'; // public domain copy icon, taken from http://publicicons.org/file-icon/
    copyButton.className = "copyButton";
    copyButton.title = "Copy Hang Stack";
    copyButton.addEventListener("click", function(event) {
      var value = entry.getElementsByClassName("hangContents")[0].textContent;
      self.port.emit("copy", value);
    });
    entry.appendChild(copyButton);
    var contents = document.createElement("div");
    contents.className = "hangContents";
    contents.appendChild(document.createTextNode(hangStack));
    entry.appendChild(contents);
    hangs.appendChild(entry);
  });
  if (hangStacks.length == 0) {
    hangs.appendChild(document.createTextNode("No hang stack traces to show."));
  }
});
