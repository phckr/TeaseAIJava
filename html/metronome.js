
var metronomeTick = new Audio("/metronome_tick.mp3");
var metronomeTimer;

function setBeatsPerMinute(bpm) {
  if (metronomeTimer) {
    clearInterval(metronomeTimer);
    metronomeTimer = null;
  }

  if (bpm <= 0) {
    return;
  }

  metronomeTimer = setInterval(function() { metronomeTick.play(); }, 60000 / bpm);
  metronomeTick.play();
}

