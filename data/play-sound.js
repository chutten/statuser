// trimmed and normalized blip sound from https://commons.wikimedia.org/wiki/File:Blip.ogg
// available under public domain
var blipSound = new Audio("blip.ogg");
self.port.on("blip", function(numberOfBlips) {
  // Play no more than 10 blips; users likely won't be able to tell the difference,
  // and we cant take too much time playing blips, or else they will not accurately represent when the hang(s) occurred
  playBlips(Math.min(10, numberOfBlips));
});

// When multiple blips come in, play the blip sound multiple times
function playBlips(numberOfBlips) {
  if (numberOfBlips < 1) {
    return;
  }

  // play the blip sound
  blipSound.currentTime = 0;
  blipSound.play();

  // we want the interval to be short so we don't take too much time for repeated blips to complete,
  // yet we want the interval long enough that the blips are clearly distinguishable from each other.
  // 200ms is a good balance between these.
  setTimeout(function() {
    playBlips(numberOfBlips - 1);
  }, 200);
}
