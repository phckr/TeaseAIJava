var socket;
var connectingSocket;
var currentRemoteChat;
var lastEvent = {};

var htmlholderid = 0;

var lasttimeadded = 0;
var lasttimechecked = 0;

var vocab = {
  DomHonorific: "Mistress",
}

let audioMap = new lru_map.LRUMap(20);

var currentTypingIndicator;
var currentAudio;
var personalityStarted;
var synthesisVoice;
var synthesizing;
var messageScrollingInProgress;

function websocketFailed(event) {
  if (event.target.ignoreError) {
    return;
  }
  if (!socket.fake) {
    addNotice("Lost communication with server");
    setStartStopError();
    playAudio();
    setBeatsPerMinute(-1);
    setupPrecanned();
    setCameraLarge(false);
    $('#htmlcontainer').empty();
    $('#htmlcontainer').hide();
    $('#input').focus();
  }
  socket = {
    send: function () {},
    fake: true
  }

  window.setTimeout(connectSocket, 5000);
}

function connectSocket() {
  if (connectingSocket) {
    connectingSocket.ignoreError = true;
    connectingSocket.close();
    connectingSocket = null;
  }
  var newSocket = new WebSocket(((window.location.protocol === "https:") ? "wss://" : "ws://") + window.location.host + "/socket");
  newSocket.addEventListener('message', function (event) { dispatchMessage(event.data); });
  newSocket.addEventListener('error', websocketFailed);
  newSocket.addEventListener('close', websocketFailed);
  newSocket.addEventListener('open', function (event) { socket = event.target; addNotice("Connected"); requestData(); });
  connectingSocket = newSocket;
}

function requestData() {
  socket.send("P" + JSON.stringify({command: "vocab", arg: "%DomHonorific%" }));
  socket.send("P" + JSON.stringify({command: "vocab", arg: "response" }));
}

function setBubbleWidth(span) {
  $(span).each(function() {
    $(this).parent()[0].style.width = (this.offsetWidth + 1) + "px";
  });
}

function sendClick(parent, item, close) {
  var contents = {};
  var parentitem = $(item).closest(parent);
  $.each(parentitem.find(':input'), function(i, field) {
      var value = $(field).val();
      if ($(field).attr("type") == "checkbox") {
        value = field.checked;
      }
      if ($(field).attr("type") == "radio") {
        if (!field.checked) {
          value = null;
        }
      }
      if (field.name && value) {
        contents[field.name] = value;
      }
  });
  var itemname = item.name || $(item).text();
  var message = {dialog:parent, click:itemname, args:contents};
  tajSend(message);
  console.log("Click: " + JSON.stringify(message));
  if (close) {
    var largehtml = $(item).closest('.largehtml');
    largehtml.find('.closebutton').click();
  }
}

function addTime() {
  // We add a time marker if it has been more than 5 minutes since previous
  // check, *or* it has been more than 1 minute since check and more than
  // 5 minutes since previous add
  if (lasttimechecked + 5 * 60 * 1000 < Date.now() ||
      (lasttimechecked + 1 * 60 * 1000 < Date.now() && lasttimeadded + 5 * 60 * 1000 < Date.now())) {
    var d = $("<div><p class=timemsg>");
    d.addClass("msg-remote");
    var s = $("<span>");
    var timemsg = new Date().toLocaleTimeString();
    timemsg = timemsg.replace(/([0-9]+:[0-9]+):[0-9]+/, "$1");
    s.text(timemsg);
    $(d).find("p.timemsg").append(s);
    $('#messages').append(d);
    scrollToBottom();
    lasttimeadded = Date.now();
  }
  lasttimechecked = Date.now();
}

function addNotice(notice) {
  var d = $("<div><p class=notice>");
  d.addClass("msg-remote");
  var s = $("<span>");
  s.text(notice);
  $(d).find("p.notice").append(s);
  $('#messages').append(d);
  scrollToBottom();
}

function makeParticipant(name, color) {
  if (name === currentRemoteChat) {
    return;
  }
  currentRemoteChat = name;
  var d = $("<div><p class=name>");
  d.addClass("msg-remote");
  var s = $("<span>");
  if (color) {
    s.css('color', "#" + color);
  }
  s.html(name);
  $(d).find("p.name").append(s);

  $('#messages').append(d);
  
}

function speechify(m) {
  return m.replaceAll(/\*(.*?)\*/g, "").replace(/\s+(Boy|Toy|Stroker|Pet|Slave)(\??)$/i, "$2. $1");
}

function speakAloud(message) {
  if (window.speechSynthesis) {
    var utterance = new SpeechSynthesisUtterance(speechify(message));
    utterance.rate = 0.8;
    if (synthesisVoice) {
      utterance.voice = synthesisVoice;
    }
    utterance.addEventListener('end', event => {
      audioPlayingStop("message");
    });
    audioPlayingStart("message");
    window.speechSynthesis.speak(utterance);
  }
}

function appendMessage(messageJson, remote) {
  addTime();
  messageJson = messageJson.replaceAll(/\n/g, "\\n");
  var messageList = JSON.parse(messageJson);
  
  var currentMessage;
  var doneName = false;

  for (var i = 0; i < messageList.length; i++) {
    var item = messageList[i];
    var message = item.text;
    if (message.startsWith("\n")) {
      continue;
    }
    var color = item.color || "fff";
    if (remote) {
      if (message.startsWith("[")) {
	var m = message.match(/^\[([^:]*?)\]: *(.*)$/);
	if (m) {
	  makeParticipant(m[1], color);
	  message = m[2];
          doneName = true;
	}
      } else if (!doneName) {
	message = message.replace(/[0-9:]+ [AP]M\s+/, "");
	var m = message.match(/^([^:]*?):\s*(.*)$/);
	if (m) {
	  makeParticipant(m[1], color);
	  message = m[2];
          doneName = true;
	}
      }
      if (synthesizing) {
        speakAloud(message);
      }
    } else {
      message = message[0].toUpperCase() + message.substring(1) + "\n";
    }

    if (!message) {
      continue;
    }

    clearTypingIndicator();

    var s = $("<span>");
    s.css('color', '#' + color);
    s.html(message);

    if (currentMessage) {
      currentMessage.append(s);
    } else {
      if (!message || message == "\n") {
	return;
      }
      var d = $("<div><p class=bubble>");
      d.addClass(remote ? "msg-remote" : "msg-local");
      currentMessage = $(d).find('p.bubble');
      currentMessage.append(s);

      $('#messages').append(d);
    }

    setBubbleWidth($('.bubble span'));

    if (message.includes("\n")) {
      currentMessage = null;
    }
  }
  scrollToBottom();
}

function clearTypingIndicator() {
  if (currentTypingIndicator) {
    currentTypingIndicator.remove();
  }
  currentTypingIndicator = null;
}

function addTypingIndicator() {
  clearTypingIndicator();
  var d = $('<div id="wave"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>');
  $('#messages').append(d);
  scrollToBottom();
  currentTypingIndicator = d;
}

function doScrollToBottom() {
  var newTop = $('#messages')[0].scrollHeight - $('#messages')[0].clientHeight;

  if (newTop > $('#messages')[0].scrollTop) {
    $("#messages").animate({ scrollTop: newTop }, { complete: function() { messageScrollingInProgress = false;}});
    messageScrollingInProgress = true;
  }
}

function scrollToBottom() {
  if (messageScrollingInProgress) {
    setTimeout(scrollToBottom, 100);
  } else {
    doScrollToBottom();
  }
}

function playAudio(uri) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    audioPlayingStop("audio");
  }
  if (!uri) {
    return;
  }
  var cached = audioMap.get(uri);
  if (cached) {
    cached.play();
    currentAudio = cached;
    return;
  }
  var a = new Audio(uri);
  a.addEventListener("canplaythrough", event => {
    audioPlayingStart("audio");
    event.target.play();
  });
  var timer = setTimeout(function() { 
    if (a == currentAudio) {
      audioPlayingStop("audio");
    }
  }, 5000);
  a.addEventListener('ended', event => {
    clearTimeout(timer);
    if (a == currentAudio) {
      audioPlayingStop("audio");
    }
  });
  currentAudio = a;
  audioMap.set(uri, a);
}

function interpretJson(j) {
  console.log("JSON: " + JSON.stringify(j));
  if (j.near) {
    $('.inner').removeClass('far').addClass('near');
  }
  if (j.far) {
    $('.inner').removeClass('near').addClass('far');
  }

  if (j.prefill) {
    if ($('#input').val() == "") {
      $('#input').val(j.prefill);
    }
  }
  if (j.headHold) {
    setHeadHold(j.headHold);
  }
  if (typeof j.largeCamera !== 'undefined') {
    setCameraLarge(j.largeCamera, j.maskPercent);
  }
  if (typeof j.html != "undefined") {
    if (j.html) {
      var closebutton = $('<img class="closebutton" src="/close-red.svg">');
      var holderid = 'htmlholder' + htmlholderid;
      closebutton.on('click', function () {
        $('#' + holderid).parent().remove();
	if ($('#htmlcontainer').children().length == 0) {
	  $('#htmlcontainer').css('display', 'none');
	  $('#input').focus();
	}
      });
      var largehtml = $('<div class="largehtml"><div id="' + holderid + '" class="htmlholder"></div></div>');
      largehtml.append(closebutton);
      $(largehtml).find('#' + holderid).html(j.html);
      // Get class and clear any old ones
      var classes = $(largehtml).find('#' + holderid).children().attr("class");
      if (classes) {
        $('#htmlcontainer').find('.' + classes.replace(/ +/g, '.')).parent().parent().remove();
      }
      $('#htmlcontainer').append(largehtml);
      $('#htmlcontainer').css('display', 'flex');
      htmlholderid += 1;
    } else {
      $('#htmlcontainer').children().last().remove();
      if ($('#htmlcontainer').children().length == 0) {
        $('#htmlcontainer').css('display', 'none');
	$('#input').focus();
      }
    }
  }
  if (j.motion) {
    setMotionDetector(j.motion);
  }
  if (j.speak) {
    speakAloud(j.speak);
  }
  if (j.photo) {
    takePhoto(j.photo);
  }
  if (j.photopaste) {
    enablePaste(j.photopaste);
  }
  if (typeof j.video != "undefined") {
    takeVideo(j.video, j.duration);
  }
  if (j.response) {
    if (j.response == "vocab") {
      if (j.arg == '%DomHonorific%' && vocab.DomHonorific != j.result) {
	setTimeout(setupPrecanned, 10);
      }
      vocab[j.arg.replaceAll("%", "")] = j.result;
    }
  }

  scrollToBottom();
}

function dispatchMessage(message) {
  var mtext = message.match(/^\*([\s\S]*)$/);
  if (mtext) {
    appendMessage(mtext[1], true);
    if (!vocab.response) {
      requestData();
    }
    return;
  }
  if (message.startsWith("D")) {
    $("#media").empty();
    var m = message.match(/^D(.*?):(.*)$/);
    if (m) {
      if (m[1] == "dom") {
        var im = $('#dom-image');
        im.attr('src', m[2]);
      } else {
	var im = $("<img class=media>");
	im.attr('src', m[2]);
	$("#media").append(im);
      }
    }
    return;
  }
  if (message.startsWith("o")) {
    setupPrecanned();
    return;
  }
  if (message.startsWith("O")) {
    var m = message.match(/^O(.*?);(.*)$/);
    if (m) {
      addPre(m[1], m[2]);
    }
    return;
  }
  var ma = message.match(/^[aA](.*)$/);
  if (ma) {
    playAudio(ma[1]);
    return;
  }
  var mm = message.match(/^M([0-9.-]+)/);
  if (mm) {
    setBeatsPerMinute(parseInt(mm[1]));
    return;
  }
  if (message == "S") {
    setStartStop(true);
    return;
  }
  if (message == "s") {
    setStartStop(false);
    return;
  }
  if (message.startsWith("J")) {
    interpretJson(JSON.parse(message.substring(1)));
    return;
  }
  var mv = message.match(/^([Vv])(.*)$/);
  if (mv) {
    $("#media").empty();
    if (mv[2]) {
      var vid = $("<video autoplay muted=1 class=media>");
      $("#media").append(vid);
      vid.attr('src', mv[2]);
    } else if ($('#media video').length) {
      $("#media").empty();
    }
    return;
  }
  var mt = message.match(/^T.*?;(.*?) is typing/);
  if (mt) {
    makeParticipant(mt[1]);
    addTypingIndicator();
    return;
  }
  if (message.startsWith("T")) {
    addTypingIndicator();
    return;
  }
  console.log("Unknown: " + message);
}

function send(message) {
  message = message.trim();
  socket.send("*" + message);
  appendMessage(JSON.stringify([{text: message, color: "fff"}]), false);
}

function tajSend(message) {
  if (!message.captured) {
    message.captured = Date.now();
  }
  socket.send("P" + JSON.stringify(message));
}

function addPre(label, content) {
  var b = $("<input class=precan type=button>");
  b.prop("value", label);
  b.prop("title", content);
  b.click(function() {
   send(content);
  });
  $("#precanned").append(b);
  scrollToBottom();
}

function setStartStopError() {
  var b = $('#startstop');
  b.prop('value', 'Not Connected');
  b.css('background-color', 'grey');
  b.prop('disabled', true);
  b.off();
}

function setStartStop(started) {
  var b = $('#startstop');
  b.prop('value', started ? 'Stop' : 'Start');
  b.css('background-color', started ? 'red' : 'blue');
  b.prop('disabled', false);
  b.off();
  b.click(function() {
    setStartStop(!started);
    socket.send("S");
    personalityStarted = started;
  });
}

function setupPrecanned() {
  $("#precanned").empty();
  addPre("Hello", "Hello " + vocab.DomHonorific);
  addPre("Yes", "Yes " + vocab.DomHonorific);
  addPre("No", "No " + vocab.DomHonorific);
  addPre("Edge", "I am on the edge");
  addPre("Sorry", "Sorry " + vocab.DomHonorific);
}

function resetInputAreaHeight(ele) {
  var newHeight = ele.scrollHeight + "px";
  if (newHeight != ele.style.height) {
    ele.style.height = 'auto';
    ele.style.height = ele.scrollHeight + "px";
    setTimeout(scrollToBottom, 10);
  }
}

$(document).ready(function() {
   $("#input").keydown(function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      return false;
    }
    return true;
  });
   $("#input").keyup(function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
       send($("#input").val());
       $("#input").val('');
       resetInputAreaHeight($('#input')[0]);
    }
    return false;
  });
  setupPrecanned();
  window.onresize();
  $('#htmlcontainer').empty();
  const voices = window.speechSynthesis.getVoices();
  for (var i = 0; i < voices.length; i++) {
    if (voices[i].name.match(/female/i)) {
      synthesisVoice = voice[i];
      break;
    }
  }
  $('#input').bind('focusout', function(e) {
      if ($('#htmlcontainer').is(":hidden")) {
            e.preventDefault();
            $(this).focus();
      }
  });
  $('#input').focus();
  $(document).mousemove(function (e) {
    e.when = Date.now();
    lastEvent.mouseMove = e;
  });
  $('#input').on('input', function() { resetInputAreaHeight(this); });
  buttplugInitialize();
});

setInterval(function() {
  if (socket) {
    var now = Date.now();
    var data = { ping: true, captured: now };
    var e = lastEvent.mouseMove;
    if (e) {
      data.mouseMove = { x: e.pageX, y: e.pageY, id: e.target.id, className: e.target.classNamei, ago: now - e.when };
    }
    socket.send("P" + JSON.stringify(data));
  }
}, 5000);


window.onresize = function () {
  const width = window.innerWidth;
  const height = window.innerHeight;

  if (width >= height) {
    $('.outer').removeClass('vertical').addClass('horizontal');
  } else {
    $('.outer').removeClass('horizontal').addClass('vertical');
  }
  $('.outer').css('height', height + "px");
  setTimeout(scrollToBottom, 50);
  setBubbleWidth($('.bubble span'));
}

document.body.onclick = function() {
  speech_start();
  videoStart();
  document.body.requestFullscreen({ navigationUI: 'hide' });
  document.body.onclick = null;
}

connectSocket();

setStartStopError();

function fitContent(item, destItem, extraHeight) {
  var width = 0;
  var height = 0;
  $(destItem).css('height', '90%');
  $(item).children().each(function (index, element) {
    var bottom = $(element).outerHeight(true) + $(element).position().top;
    var right = $(element).outerWidth(true) + $(element).position().left;
    if (bottom > height) {
      height = bottom;
    }
    if (right > width) {
      width = right;
    }
  });

  $(destItem).css('width', width + "px");
  $(destItem).css('height', height + extraHeight + "px");
}

