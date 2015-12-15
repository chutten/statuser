var self = require("sdk/self");

const windowUtils = require("sdk/window/utils");
var gBrowser = windowUtils.getMostRecentBrowserWindow().getBrowser();
var gWindow = windowUtils.getMostRecentBrowserWindow();

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
  badge: undefined,
  badgeColor: "red",
  icon: mBaseSVG.replace(ANIMATE_TEMPLATE, mAnimateSVG),
});

function changeState(button, aBaseSVG, aAnimateSVG = mAnimateSVG) {
  mBaseSVG = aBaseSVG || mBaseSVG;
  mAnimateSVG = aAnimateSVG;
  button.state("window", {
    icon: mBaseSVG.replace(ANIMATE_TEMPLATE, mAnimateSVG),
  });
}

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
  if (aWebProgress.isTopLevel
    && aStateFlags & Ci.nsIWebProgressListener.STATE_IS_WINDOW) {
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

const HANG_THRESHOLD = 126; // ms over which a bucket must start to be counted as a hang
function numGeckoHangs() {
  let geckoThread = Services.telemetry.threadHangStats.find(thread =>
    thread.name == "Gecko"
  );
  if (!geckoThread || !geckoThread.activity.counts) {
    console.warn("Lolwhut? No Gecko thread? No hangs?");
    return;
  }
  let numHangs = 0;
  geckoThread.activity.counts.forEach((count, i) => {
    if (geckoThread.activity.ranges[i] > HANG_THRESHOLD) {
      numHangs += count;
    }
  });
  return numHangs;
}

const BADGE_COLOURS = ["red", "blue", "brown", "black"];
const CHECK_FOR_HANG_INTERVAL = 400; // in millis
let numHangs = numGeckoHangs();
let baseNumHangs = numHangs;
let hangCount;
setInterval(() => {
  hangCount = numGeckoHangs();
  if (hangCount > numHangs) {
    numHangs = hangCount;
    updateBadge();
    //exports.observe(undefined, "thread-hang");
  }
}, CHECK_FOR_HANG_INTERVAL);

let prevFrameTime = Cu.now();
let numHangsObserved = 0;
/* Enable this rAF loop to verify that the hangs reported are roughly equal
 * to the number of hangs observed from script. In Nightly 45, they were.
gWindow.requestAnimationFrame(function framefn() {
  let currentFrameTime = Cu.now();
  if (currentFrameTime - prevFrameTime > HANG_THRESHOLD) {
    numHangsObserved++;
    updateBadge();
  }
  prevFrameTime = currentFrameTime;
  gWindow.requestAnimationFrame(framefn);
});
*/

function updateBadge() {
  button.badge = (numHangs - baseNumHangs) - numHangsObserved;
  button.badgeColor - BADGE_COLOURS[button.badge % BADGE_COLOURS.length];
}
