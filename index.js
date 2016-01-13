var self = require("sdk/self");
var ss = require("sdk/simple-storage");

const windowUtils = require("sdk/window/utils");
var gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
var gWindow = windowUtils.getMostRecentBrowserWindow();

// load and validate settings
var gMode = ss.storage.mode;
if (gMode !== "threadHangs" && gMode !== "eventLoopLags") {
  gMode = "threadHangs";
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
});
function showPanel() {
  panel.show({position: button});
  panel.port.emit("show", { // emit event on the panel's port so the script inside knows it's shown
    hangThreshold: gHangThreshold,
    mode: gMode,
  });
}

// Switch modes between thread hang detection and event loop lag detection
panel.port.on("mode-changed", function(mode) {
  gMode = mode;
  ss.storage.mode = mode;
  clearCount();
});

// Set the hang threshold
panel.port.on("hang-threshold-changed", function(hangThreshold) {
  gHangThreshold = hangThreshold;
  ss.storage.hangThreshold = hangThreshold;
});

// Clear the hang counter
panel.port.on("clear-count", function() {
  clearCount();
});

// Open external links clicked in the panel in a new tab
panel.port.on("open-link", function(url) {
  require("sdk/tabs").open(url);
  panel.hide();
});

exports.observe = function (subject, topic, data) {
  switch (topic) {
    case "user-interaction-active":
      changeState(button, RED_SVG);
      break;
    case "user-interaction-inactive":
      changeState(button, BLUE_CIRCLE_SVG);
      break;
    case "thread-hang":
      changeState(button, YELLOW_SVG);
      break;
    default:
      console.warn("Unknown subject: ", subject);
      break;
  }
};

exports.onStateChange = function (aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
  if (aWebProgress.isTopLevel && aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW) {
    if (aStateFlags & Ci.nsIWebProgressListener.STATE_START) {
      changeState(button, undefined, ANIMATE_ROTATE_SVG);
    } else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP) {
      changeState(button, undefined, '');
    }
  }
};

const {Cc, Ci, Cu} = require("chrome");

Cu.import("resource://gre/modules/Services.jsm");

let gOS = Cc["@mozilla.org/observer-service;1"]
            .getService(Ci.nsIObserverService);

gOS.addObserver(exports, "user-interaction-active", false);
gOS.addObserver(exports, "user-interaction-inactive", false);

gBrowser.addTabsProgressListener(exports)

function numGeckoHangs() {
  switch(gMode) {
    case "threadHangs": {
      return numThreadHangs();
    }
    case "eventLoopLags": {
      return numEventLoopLags();
    }
    default:
      console.warn("Unknown mode: ", gMode);
      return 0;
  }
}

function numThreadHangs() {
  let geckoThread = Services.telemetry.threadHangStats.find(thread =>
    thread.name == "Gecko"
  );
  if (!geckoThread || !geckoThread.activity.counts) {
    console.warn("Lolwhut? No Gecko thread? No hangs?");
    return;
  }
  let numHangs = 0;
  geckoThread.activity.counts.forEach((count, i) => {
    if (geckoThread.activity.ranges[i] > gHangThreshold) {
      numHangs += count;
    }
  });
  return numHangs;
}

function numEventLoopLags() {
  let snapshot = Services.telemetry.getHistogramById("EVENTLOOP_UI_ACTIVITY_EXP_MS").snapshot();
  let result = 0;
  for (let i = 0; i < snapshot.ranges.length; ++i) {
    if (snapshot.ranges[i] > 50) {
      result += snapshot.counts[i];
    }
  }
  return result;
}


const BADGE_COLOURS = ["red", "blue", "brown", "black"];
let numHangsObserved = 0;

function updateBadge() {
  button.badge = (numHangs - baseNumHangs) - numHangsObserved;
  button.badgeColor = BADGE_COLOURS[button.badge % BADGE_COLOURS.length];
}

function clearCount() {
  baseNumHangs = numHangs;
  numHangsObserved = 0;
  updateBadge();
}

const CHECK_FOR_HANG_INTERVAL = 400; // in millis
let numHangs = numGeckoHangs();
let baseNumHangs = numHangs; // the number of hangs at the time the counter was last reset
let hangCount;
setInterval(() => {
  hangCount = numGeckoHangs();
  if (hangCount > numHangs) {
    numHangs = hangCount;
    updateBadge();
    //exports.observe(undefined, "thread-hang");
  }
}, CHECK_FOR_HANG_INTERVAL);
updateBadge();

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
