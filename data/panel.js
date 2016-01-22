// emit events on the panel's port for corresponding actions
var countThreadHangs = document.getElementById("countThreadHangs");
var countEventLoopLags = document.getElementById("countEventLoopLags");
var countInputEventResponseLags = document.getElementById("countInputEventResponseLags");
countThreadHangs.addEventListener("click", function() {
  self.port.emit("mode-changed", "threadHangs");
});
countEventLoopLags.addEventListener("click", function() {
  self.port.emit("mode-changed", "eventLoopLags");
});
countInputEventResponseLags.addEventListener("click", function() {
  self.port.emit("mode-changed", "inputEventResponseLags");
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
    case "inputEventResponseLags":
      document.getElementById("countInputEventResponseLags").checked = true;
      break;
    default:
      console.warn("Unknown mode: ", currentSettings.mode);
  }
});

// process warning messages
self.port.on("warning", function(warningType) {
  var banner = document.getElementById("warningBanner");
  switch (warningType) {
    case null:
      banner.style.display = "none";
      break;
    case "unavailableBHR":
      banner.innerHTML = "BACKGROUND HANG REPORTING <a href=\"about:telemetry\" target=\"_blank\">UNAVAILABLE</a>; ENABLE BHR AND RESTART FIREFOX";
      banner.style.display = "block";
      break;
    case "unavailableEventLoopLags":
      banner.innerHTML = "EVENTLOOP_UI_ACTIVITY_EXP_MS HISTOGRAM <a href=\"about:telemetry\" target=\"_blank\">UNAVAILABLE</a>; CHECK FIREFOX VERSION";
      banner.style.display = "block";
      break;
    case "unavailableInputEventResponseLags":
      banner.innerHTML = "INPUT_EVENT_RESPONSE_MS HISTOGRAM <a href=\"about:telemetry\" target=\"_blank\">UNAVAILABLE</a>; CHECK FIREFOX VERSION";
      banner.style.display = "block";
      break;
    default:
      banner.innerHTML = "UNKNOWN WARNING: " + warningType;
      banner.style.display = "block";
      break;
  }
});

function setHangs(hangs) {
  var entriesContainer = document.getElementById("hangStacks");
  entriesContainer.innerHTML = ""; // clear the hang entries
  hangs.reverse().forEach(hang => {
    // create an entry for the hang
    var entry = document.createElement("div");
      var contents = document.createElement("pre");
      contents.className = "stack";
      contents.appendChild(document.createTextNode(hang.stack));
      entry.appendChild(contents);
      var controls = document.createElement("div");
        controls.className = "controls";
        var duration = document.createElement("span");
        if (hang.upperBound == Infinity) {
          duration.innerHTML = hang.lowerBound + "+ ms ";
        } else {
          duration.innerHTML = hang.lowerBound + "-" + hang.upperBound + " ms ";
        }
        duration.className = "duration";
        controls.appendChild(duration);
        var copyButton = document.createElement("button");
        copyButton.innerHTML = '<img src="copy-icon.svg" />'; // public domain copy icon, taken from http://publicicons.org/file-icon/
        copyButton.className = "copyButton";
        copyButton.title = "Copy Hang Stack";
        copyButton.addEventListener("click", function(event) {
          var value = entry.getElementsByClassName("stack")[0].textContent;
          self.port.emit("copy", value);
        });
        controls.appendChild(copyButton);
        var timestamp = document.createElement("div");
        timestamp.innerHTML = (new Date(hang.timestamp)).toLocaleString();
        timestamp.className = "time";
        controls.appendChild(timestamp);
        var uptime = document.createElement("div");
        if (hang.uptime === null) {
          uptime.innerHTML = "unknown uptime";
        } else {
          uptime.innerHTML = Math.round(hang.uptime) + "ms uptime";
        }
        uptime.className = "time";
        controls.appendChild(uptime);
      entry.appendChild(controls);
    entriesContainer.appendChild(entry);
  });
  if (hangs.length == 0) {
    entriesContainer.appendChild(document.createTextNode("No hang data available."));
  }
}

self.port.on("set-hangs", setHangs);
setHangs([]);
