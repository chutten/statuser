var self = require("sdk/self");
var ss = require("sdk/simple-storage");
var clipboard = require("sdk/clipboard");
var windowUtils = require("sdk/window/utils");

// load and validate settings
var gMode = ss.storage.mode;
if (gMode !== "threadHangs" && gMode !== "eventLoopLags" && gMode !== "inputEventResponseLags") {
  gMode = "threadHangs";
}
var gPlaySound = ss.storage.playSound;
if (typeof gPlaySound !== "boolean") {
  gPlaySound = false;
}
var gHangThreshold = ss.storage.hangThreshold; // ms over which a bucket must start to be counted as a hang
if (typeof gHangThreshold !== "number" || gHangThreshold < 1) {
  gHangThreshold = 126;
}

const { setInterval } = require("sdk/timers");
const { ActionButton } = require("sdk/ui/button/action");

const ANIMATE_TEMPLATE = '<!-- ANIMATE -->';
const ANIMATE_ROTATE_SVG = '' +
  '<animateTransform attributeName="transform" ' +
                    'attributeType="XML" ' +
                    'type="rotate" ' +
                    'from="0 60 70" ' +
                    'to="360 60 70" ' +
                    'dur="10s" ' +
                    'repeatCount="indefinite"/>';
const RED_SVG = 'data:image/svg+xml,' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
    '<rect width="100%" height="100%" fill="red">' +
      ANIMATE_TEMPLATE +
    '</rect>' +
  '</svg>';
const BLUE_CIRCLE_SVG = 'data:image/svg+xml,' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
    '<circle r="50%" cx="50%" cy="50%" fill="blue">' +
      ANIMATE_TEMPLATE +
    '</circle>' +
  '</svg>';
const YELLOW_SVG = RED_SVG.replace('red', 'yellow');

var mBaseSVG = RED_SVG;
var mAnimateSVG = '';
var mBaseLabel = "User Interaction Active";

var button = ActionButton({
  id: "active-button",
  label: mBaseLabel,
  badge: 0,
  badgeColor: "red",
  icon: mBaseSVG.replace(ANIMATE_TEMPLATE, mAnimateSVG),
  onClick: showPanel,
});

function changeState(button, aBaseSVG, aAnimateSVG = mAnimateSVG) {
  mBaseSVG = aBaseSVG || mBaseSVG;
  mAnimateSVG = aAnimateSVG;
  button.state("window", {
    icon: mBaseSVG.replace(ANIMATE_TEMPLATE, mAnimateSVG),
  });
}

var panel = require("sdk/panel").Panel({
  contentURL: "./panel.html",
  contentScriptFile: "./panel.js",
  width: 500,
  height: 600,
});
function showPanel() {
  panel.show({position: button});
  panel.port.emit("show", { // emit event on the panel's port so the script inside knows it's shown
    playSound: gPlaySound,
    hangThreshold: gHangThreshold,
    mode: gMode,
  });
}

// switch modes between thread hang detection and event loop lag detection
panel.port.on("mode-changed", function(mode) {
  gMode = mode;
  ss.storage.mode = mode;
  clearCount();
});

// toggle notification sound on and off
panel.port.on("play-sound-changed", function(playSound) {
  gPlaySound = playSound;
  ss.storage.playSound = playSound;
});

// set the hang threshold
panel.port.on("hang-threshold-changed", function(hangThreshold) {
  gHangThreshold = hangThreshold;
  ss.storage.hangThreshold = hangThreshold;
});

// clear the hang counter
panel.port.on("clear-count", function() {
  clearCount();
});

// copy a value to the clipboard
panel.port.on("copy", function(value) {
  clipboard.set(value);
});

const {Cc, Ci, Cu} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");

let gOS = Cc["@mozilla.org/observer-service;1"]
            .getService(Ci.nsIObserverService);

// the toolbar icon should be red while the user is active, and blue when not
gOS.addObserver({
  observe: function (subject, topic, data) {
    changeState(button, RED_SVG);
  }
}, "user-interaction-active", false);
gOS.addObserver({
  observe: function (subject, topic, data) {
    changeState(button, BLUE_CIRCLE_SVG);
  }
}, "user-interaction-inactive", false);

// show the spinning icon when any tabs are loading
var webProgressListener = {
  // see https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIWebProgressListener#onStateChange%28%29
  onStateChange: function (aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    if (aWebProgress.isTopLevel && aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW) {
      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
        changeState(button, YELLOW_SVG, ANIMATE_ROTATE_SVG);
      } else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
        changeState(button, undefined, "");
      }
    }
  }
};
var gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
gBrowser.addTabsProgressListener(webProgressListener);

function numGeckoHangs() {
  var hangs;
  switch(gMode) {
    case "threadHangs":
      hangs = numGeckoThreadHangs();
      panel.port.emit("warning", hangs === null ? "unavailableBHR" : null);
      return hangs
    case "eventLoopLags":
      hangs = numEventLoopLags();
      panel.port.emit("warning", hangs === null ? "unavailableEventLoopLags" : null);
      return hangs;
    case "inputEventResponseLags":
      hangs = numInputEventResponseLags();
      panel.port.emit("warning", hangs === null ? "unavailableInputEventResponseLags" : null);
    default:
      console.warn("Unknown mode: ", gMode);
      return 0;
  }
}

function numGeckoThreadHangs() {
  let geckoThread = Services.telemetry.threadHangStats.find(thread =>
    thread.name == "Gecko"
  );
  if (!geckoThread || !geckoThread.activity.counts) {
    console.warn("Lolwhut? No Gecko thread? No hangs?");
    return null;
  }
  let numHangs = 0;
  // see the NOTE in mostRecentHangs() for caveats when using the activity.counts histogram
  // to summarize, the ranges are the inclusive upper bound of the histogram rather than the inclusive lower bound
  geckoThread.activity.counts.forEach((count, i) => {
    if (geckoThread.activity.ranges[i - 1] > gHangThreshold) {
      numHangs += count;
    }
  });
  return numHangs;
}

function numEventLoopLags() {
  try {
    var snapshot = Services.telemetry.getHistogramById("EVENTLOOP_UI_ACTIVITY_EXP_MS").snapshot();
  } catch (e) { // histogram doesn't exist, the Firefox version is likely older than 45.0a1
    return null;
  }
  let result = 0;
  for (let i = 0; i < snapshot.ranges.length; ++i) {
    if (snapshot.ranges[i] > gHangThreshold) {
      result += snapshot.counts[i];
    }
  }
  return result;
}

function numInputEventResponseLags() {
  try {
    var snapshot = Services.telemetry.getHistogramById("INPUT_EVENT_RESPONSE_MS").snapshot();
  } catch (e) { // histogram doesn't exist, the Firefox version is likely older than 46.0a1
    return null;
  }
  let result = 0;
  for (let i = 0; i < snapshot.ranges.length; ++i) {
    if (snapshot.ranges[i] > gHangThreshold) {
      result += snapshot.counts[i];
    }
  }
  return result;
}

var soundPlayerPage = require("sdk/page-worker").Page({
  contentScriptFile: "./play-sound.js",
  contentURL: "./play-sound.html",
});

// retrieve the UNIX millisecond timestamp for when Firefox started
var startupTimestamp;
try {
  startupTimestamp = Services.prefs.getIntPref("toolkit.startup.last_success") * 1000;
} catch (e) { // retrieving the pref failed, but we can still fail gracefully and just not show it
  startupTimestamp = null;
}

// Returns an array of the most recent BHR hangs
var previousCountsMap = {}; // this is a mapping from stack traces (as strings) to corresponding histogram counts
var recentHangs = [];
function mostRecentHangs() {
  let geckoThread = Services.telemetry.threadHangStats.find(thread =>
    thread.name == "Gecko"
  );
  if (!geckoThread) {
    console.warn("Uh oh, there doesn't seem to be a thread with name \"Gecko\"!");
    return [];
  }

  var timestamp = (new Date()).getTime(); // note that this timestamp will only be as accurate as the interval at which this function is called
  var uptime;
  if (startupTimestamp === null) {
    uptime = null;
  } else {
    uptime = timestamp - startupTimestamp; // the purpose of showing the uptime is to allow users to match hangs detected using BHR with spikes in the Gecko Profiler addon
  }

  // diff the current hangs with the previous hangs to figure out what changed in this call, if anything
  // hangs list will only ever grow: https://dxr.mozilla.org/mozilla-central/source/xpcom/threads/BackgroundHangMonitor.cpp#440
  // therefore, we only need to check current stacks against previous stacks - there is no need for a 2 way diff
  // hangs are identified by their stack traces: https://dxr.mozilla.org/mozilla-central/source/toolkit/components/telemetry/Telemetry.cpp#4316
  geckoThread.hangs.forEach(hangEntry => {
    var stack = hangEntry.stack.slice(0).reverse().join("\n");
    var ranges = hangEntry.histogram.ranges.concat([Infinity]);
    var counts = hangEntry.histogram.counts;
    var previousCounts = previousCountsMap.hasOwnProperty(stack) ? previousCountsMap[stack] : [];

    // diff this hang histogram with the previous hang histogram
    counts.forEach((count, i) => {
      var previousCount = previousCounts[i] || 0;
      /*
      NOTE: when you access the thread hangs, the ranges are actually the inclusive upper bounds of the buckets rather than the inclusive lower bound like other histograms.
      Basically, when we access the buckets of a TimeHistogram in JS, it has a 0 prepended to the ranges; in C++, the indices behave as all other histograms do.

      For example, bucket 7 actually represents hangs of duration 64ms to 127ms, inclusive. For most other exponential histograms, this would be 128ms to 255ms.

      References:
      * mozilla::Telemetry::CreateJSTimeHistogram - http://mxr.mozilla.org/mozilla-central/source/toolkit/components/telemetry/Telemetry.cpp#2947
      * mozilla::Telemetry::TimeHistogram - http://mxr.mozilla.org/mozilla-central/source/toolkit/components/telemetry/ThreadHangStats.h#25
      */
      while (count > previousCount) { // each additional count here is a new hang with this stack and a duration in this bucket's range
        if (ranges[i - 1] > gHangThreshold) { // `ranges[i - 1]` is the lower bound here for this particular histogram
          recentHangs.push({stack: stack, lowerBound: ranges[i - 1], upperBound: ranges[i], timestamp: timestamp, uptime: uptime});
          if (recentHangs.length > 10) { // only keep the last 10 items
            recentHangs.shift();
          }
        }
        count --;
      }
    });

    // the hang entry is not mutated when new instances of this hang come in
    // since we aren't using this entry in the previous hangs anymore, we can just set it in the previous hangs
    previousCountsMap[stack] = counts;
  });

  return recentHangs;
}

const BADGE_COLOURS = ["red", "blue", "brown", "black"];
let numHangsObserved = 0;
let prevNumHangs = null;
function updateBadge() {
  if (numHangs === null) {
    button.badge = "?"
    button.badgeColor = "yellow";
    prevNumHangs = null;
  } else {
    button.badge = (numHangs - baseNumHangs) - numHangsObserved;
    button.badgeColor = BADGE_COLOURS[button.badge % BADGE_COLOURS.length];

    // tell the panel to play a sound if the number of hangs has been incremented
    if (gPlaySound && prevNumHangs !== null && button.badge > prevNumHangs) {
     soundPlayerPage.port.emit("blip", button.badge - prevNumHangs);
    }
    prevNumHangs = button.badge;
  }
}

// reset the current hang stacks so we only show the new ones coming in
mostRecentHangs();
recentHangs = [];

const CHECK_FOR_HANG_INTERVAL = 400; // in millis
let numHangs = numGeckoHangs(); // note: this will be null if the hang counter is not available
let baseNumHangs = numHangs; // the number of hangs at the time the counter was last reset
let hangCount;
setInterval(() => {
  hangCount = numGeckoHangs();
  if (hangCount > numHangs) {
    numHangs = hangCount;
    updateBadge();
    panel.port.emit("set-hangs", mostRecentHangs());
    //exports.observe(undefined, "thread-hang");
  }
}, CHECK_FOR_HANG_INTERVAL);
updateBadge();

function clearCount() {
  baseNumHangs = numHangs;
  numHangsObserved = 0;
  updateBadge();
  panel.port.emit("set-hangs", []); // clear the panel's list of hangs
  recentHangs = []; // empty out the list of hangs
}

/* Enable this rAF loop to verify that the hangs reported are roughly equal
 * to the number of hangs observed from script. In Nightly 45, they were.
var prevFrameTime = Cu.now();
gWindow.requestAnimationFrame(function framefn() {
  let currentFrameTime = Cu.now();
  if (currentFrameTime - prevFrameTime > gHangThreshold) {
    numHangsObserved++;
    updateBadge();
  }
  prevFrameTime = currentFrameTime;
  gWindow.requestAnimationFrame(framefn);
});
*/
