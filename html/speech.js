var SpeechRecognition = SpeechRecognition || webkitSpeechRecognition
var SpeechGrammarList = SpeechGrammarList || webkitSpeechGrammarList
var SpeechRecognitionEvent = SpeechRecognitionEvent || webkitSpeechRecognitionEvent

var recognition = new SpeechRecognition();
var speechRecognitionList = new SpeechGrammarList();
//speechRecognitionList.addFromString(grammar, 1);
recognition.grammars = speechRecognitionList;
recognition.continuous = true;
recognition.lang = 'en-US';
recognition.interimResults = false;
recognition.maxAlternatives = 1;

var recognitionStarted = false;
var recognitionDesiredState = false;

var audioPlaying = new Set();

function audioPlayingStart(type) {
  audioPlaying.add(type);
  speech_stop();
}

function audioPlayingStop(type) {
  audioPlaying.delete(type);
  if (!audioPlaying.size) {
    speech_start();
  }
}

function speech_start() {
  recognitionDesiredState = true;
  speech_restart();
}

function speech_restart(inCallback) {
  if (!recognitionDesiredState) {
    return;
  }
  if (inCallback) {
    window.setTimeout(function() { speech_start(); }, 500);
    return;
  }
  try {
    recognition.start();
  } catch (err) {
    console.log("Speech_restart: " + err);
  }
  recognitionStarted = true;
}

function speech_stop() {
  recognitionDesiredState = false;
  if (recognitionStarted) {
    recognition.abort();
    recognitionStarted = false;
  }
}

recognition.onresult = function(event) {
  // The SpeechRecognitionEvent results property returns a SpeechRecognitionResultList object
  // The SpeechRecognitionResultList object contains SpeechRecognitionResult objects.
  // It has a getter so it can be accessed like an array
  // The first [0] returns the SpeechRecognitionResult at the last position.
  // Each SpeechRecognitionResult object contains SpeechRecognitionAlternative objects that contain individual results.
  // These also have getters so they can be accessed like arrays.
  // The second [0] returns the SpeechRecognitionAlternative at position 0.
  // We then return the transcript property of the SpeechRecognitionAlternative object
  var input = event.results[event.resultIndex][0].transcript.trim();
  if (input.toLowerCase() == "free") {
    input = "3";
  }

  if (input.toLowerCase() == "start" && !personalityStarted) {
    setStartStop(true);
  } else {
    send(input);
  }

  speech_restart(true);
}

recognition.onspeechend = function() {
  console.log("on speech end");
  speech_restart(true);
}

recognition.onnomatch = function(event) {
  console.log("on no match");
  speech_restart(true);
}

recognition.onerror = function(event) {
  speech_restart(true);
}
