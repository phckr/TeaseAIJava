var videoElement = document.querySelector("video#self");
const VIDEOSCALE = 2;
const THRESHOLD = 0.5;
const M_THRESHOLD = 0.85;

var cameraIndex = 0;
var imageCapture;
var videoCapture;
var drawPosenetResults = false;
var motionDetector = false;
var posenetAnalysisTime = 100;

function sendDataAs(type, name, data) {
  var toSend = {};
  toSend[type] = [{ name: name, value: data }];
  tajSend(toSend);
}

function getCompressedImageURL(blob, done) {
  // Render blob into <img>
  const img = document.createElement('img');
  img.src = URL.createObjectURL(blob);
  img.onload = function (e) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    // Copy <img> into new canvas
    const context = canvas.getContext('2d');
    context.drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    // Convert canvas to data URI -- try webp and jpeg
    var url = canvas.toDataURL("image/webp");
    if (url.startsWith("data:image/png")) {
      url = canvas.toDataURL("image/jpeg");
    }

    // return result
    done(url);
  };
}

function attachVideo() {
  navigator.mediaDevices
    .enumerateDevices()
    .then(gotDevices)
    .then(getStream)
    .catch(handleError);
}

function checkMediaDevices() {
  if (!videoElement.srcObject || !videoElement.srcObject.active) {
    $('#self-container').find('.marker').remove();
    attachVideo();
  }
}

if (navigator.mediaDevices !== null) {
  navigator.mediaDevices.ondevicechange = checkMediaDevices;
}

var constraints = {
  video: {
    deviceId: {},
    //aspectRatio: 16 / 9,
  },
};

function detachVideo() {
  stopStream();
  videoElement.srcObject = null;
  imageCapture = null;
  videoCapture = null;
  $('#camera-off').show();
}

function enablePaste(name) {
  if (!name) {
    document.onpaste = null;
  } else {
    document.onpaste = function (event) {
      var items = (event.clipboardData || event.originalEvent.clipboardData).items;
      for (var index = 0; index < items.length; index++) {
	var item = items[index];
	if (item.type.startsWith("image/")) {
	  enablePaste(null);
	  getCompressedImageURL(item.getAsFile(), function (data) {
	    sendDataAs('images', name, data);
	  });
	  break;
	}
      }
    };
  }
}

function setCameraLarge(enable, maskPercent) {
  detachVideo();
  // We want to get rid of the image, and display the camera view large
  if (enable) {
    $('#reclight').hide();
    $('#largecameracontainer').css('display', 'flex');
    videoElement = document.querySelector("video#largeself");
    $(videoElement).prop('width', 720 * 4 / 3);
    $(videoElement).prop('height', 720);
    if (maskPercent > 0) {
      $('#mask').css('width', maskPercent + "%");
      $('#mask').css('height', maskPercent + "%");
      $('#mask').css('top', (100 - maskPercent) / 2 + "%");
      $('#mask').css('left', (100 - maskPercent) / 2 + "%");
      $('#mask').show();
    } else {
      $('#mask').hide();
    }
  } else {
    $('#largecameracontainer').css('display', 'none');
    videoElement = document.querySelector("video#self");
  }

  attachVideo();
}

var headHoldRegion;

function setHeadHold(mode) {
  if (mode == "reset") {
    headHoldRegion = null;
  }
}

function gotDevices(deviceInfos) {
  var cameras = 0;
  var numCameras = 0;
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    if (deviceInfo.kind === "videoinput") {
      numCameras++;
    }
  }
  if (numCameras > 1) {
    $('#switch').show();
    $('#switch-bg').show();
  } else {
    $('#switch').hide();
    $('#switch-bg').hide();
  }

  if (numCameras > 0) {
    cameraIndex = cameraIndex % numCameras;

    for (let i = 0; i !== deviceInfos.length; ++i) {
      const deviceInfo = deviceInfos[i];
      if (deviceInfo.kind === "videoinput") {
	if (cameraIndex == cameras) {
          if (deviceInfo.deviceId) {
	    constraints.video.deviceId.exact = deviceInfo.deviceId;
          }
	}
	cameras++;
      } else {
	//console.log("Found another kind of device: ", deviceInfo);
      }
    }
  }
}

function stopStream() {
  if (window.stream) {
    window.stream.getTracks().forEach(function (track) {
      track.stop();
    });
    window.stream = null;
  }

}

function getStream() {
  stopStream();
  navigator.mediaDevices
    .getUserMedia(constraints)
    .then(gotStream)
    .catch(handleError);
}

function gotStream(stream) {
  window.stream = stream; // make stream available to console
  videoElement.srcObject = stream;
  imageCapture = new ImageCapture(stream.getVideoTracks()[0]);
  videoCapture = new MediaRecorder(stream);
  if (videoElement == document.querySelector('video#self')) {
    $('#camera-off').hide();
  }
}

function nextCamera() {
  cameraIndex++;
  attachVideo();
}

function handleError(error) {
  console.error("Error: ", error);
}

$('img#switch').click(function() {
  nextCamera();
});

const net_v1 = { architecture: 'MobileNetV1',
  outputStride: 16,
  inputResolution: 400, //{ width: 266, height: 200 },
  multiplier: 0.75 };

const net_v2 = {architecture: 'ResNet50',
  outputStride: 32,
  inputResolution: { width: 266, height: 200 },
  quantBytes: 2};

function checkInRegion(point, minX, maxX, minY, maxY, expandX, expandY) {
  const x = point.position.x;
  const y = point.position.y;

  expandX *= maxX - minX;
  expandY *= maxY - minY;

  return (x >= (minX - expandX) && x <= (maxX + expandX) && (y >= minY - expandY) && (y <= maxY + expandY));
}

function mergeRegion(r90, r10) {
  if (r90 != null) {
    return {
      minX: r90.minX * 0.9 + r10.minX * 0.1,
      maxX: r90.maxX * 0.9 + r10.maxX * 0.1,
      minY: r90.minY * 0.9 + r10.minY * 0.1,
      maxY: r90.maxY * 0.9 + r10.maxY * 0.1
    }
  }

  return r10;
}

function evaluatePosition(posenetResult) {
  var result = { present: false, far: false, handByFace: false, handByCrotch: false};
  const keyPoints = posenetResult.keypoints;
  var canSee = 0;
  for (var i = 0; i < 17; i++) {
    if (keyPoints[i].score > THRESHOLD) {
      canSee = canSee + (1 << i);
    }
  }
  if (canSee & 0x07f) {
    result.present = true;
    // Can see head
    if (canSee & 0x1f800) {
      //lower part of body
      result.far = true;
    }
  }

  if ((canSee & 0x7) == 0x7) {
    newHeadHoldRegion = {
      minX: 10000,
      maxX: 0,
      minY: 10000,
      maxY: 0,
    };
    for (var i = 0; i < 3; i++) {
      var pos = keyPoints[i].position;
      if (pos.x > newHeadHoldRegion.maxX) {
	newHeadHoldRegion.maxX = pos.x;
      }
      if (pos.x < newHeadHoldRegion.minX) {
	newHeadHoldRegion.minX = pos.x;
      }
      if (pos.y > newHeadHoldRegion.maxY) {
	newHeadHoldRegion.maxY = pos.y;
      }
      if (pos.y < newHeadHoldRegion.minY) {
	newHeadHoldRegion.minY = pos.y;
      }
    }
    headHoldRegion = mergeRegion(headHoldRegion, newHeadHoldRegion);

    if ((canSee & 0x7) == 0x7) {
      result.headHold = true;
      for (var i = 0; i < 3; i++) {
        if (!checkInRegion(keyPoints[i], headHoldRegion.minX, headHoldRegion.maxX, headHoldRegion.minY, headHoldRegion.maxY, 0.30, 0.30)) {
	  result.headHold = false;
        }
      }
    } else {
      result.headHold = false;
    }
  }

  if (canSee & 0x600) {
    // wrists
    if ((canSee & 0x61) == 0x61) {
      // Shoulders and nose
      // If wrists are above average of shoulders, below nose and with shoulders width, then
      // assume on face
      var shoulderMidY = (keyPoints[5].position.y + keyPoints[6].position.y) / 2;
      if (canSee & 400) {
        if (checkInRegion(keyPoints[10], keyPoints[5].position.x, keyPoints[6].position.x, keyPoints[0].position.y, shoulderMidY, 0.15, 0)) {
          result.handByFace = true;
        }
      }
      if (canSee & 200) {
        if (checkInRegion(keyPoints[9], keyPoints[5].position.x, keyPoints[6].position.x, keyPoints[0].position.y, shoulderMidY, 0.15, 0)) {
          result.handByFace = true;
        }
      }
    }
    if ((canSee & 0x1860) == 0x1860) {
      // hips & shoulders
      // If wrists are within 25% of hips vertically (compared to shoulders) and are within -10 to 110% of hips
      // assume on crotch
      var shoulderMidY = (keyPoints[5].position.y + keyPoints[6].position.y) / 2;
      var hipMidY = (keyPoints[11].position.y + keyPoints[12].position.y) / 2;
      var torsoLength = hipMidY - shoulderMidY;
      if (canSee & 400) {
        if (checkInRegion(keyPoints[10], keyPoints[11].position.x, keyPoints[12].position.x, hipMidY - torsoLength / 4, hipMidY + torsoLength / 4, 0.15, 0)) {
          result.handByCrotch = true;
        }
      }
      if (canSee & 200) {
        if (checkInRegion(keyPoints[9], keyPoints[11].position.x, keyPoints[12].position.x, hipMidY - torsoLength / 4, hipMidY + torsoLength / 4, 0.15, 0)) {
          result.handByCrotch = true;
        }
      }
    }
  }

  return result;
}

function drawResults(where, result) {
  const keyPoints = result.keypoints;

  where.find('.marker').remove();

  for (var i = 0; i < 17; i++) {
    if (keyPoints[i].score > THRESHOLD) {
      var m = $('<div class=marker>');
      const x = keyPoints[i].position.x / VIDEOSCALE - 2;
      const y = keyPoints[i].position.y / VIDEOSCALE - 2;
      if (y >= 2 && y <= 197) {
        m.offset({top: y, left: x });
        where.append(m);
      }
    }
  }
}

var personPosition = -1;
var lastPosenetSend = 0;

var personDistance;
var posenetResultFunction;
var posenetResultTimer;

posenet.load(net_v1).then(function(net) {
        // posenet model loaded

posenetResultFunction = function() { 
  const start = Date.now();
  // Get the aspect ratio of the video
  var aspectRatio = $('#self').prop('videoWidth') / $('#self').prop('videoHeight');
  $('#self').prop('width', VIDEOSCALE * aspectRatio * $('#self-container').height());
  $('#self').prop('height', VIDEOSCALE * $('#self-container').height());
  $('#scaler').css('margin-right', -($('#scaler').width() / 2) + "px");
  const imageElement = videoElement;
  // load the posenet model
  if (imageElement.srcObject && imageElement.srcObject.active) {
    const pose = net.estimateSinglePose(imageElement, { flipHorizontal: true });
    pose.then(function(result) { 
      var took = Date.now() - start;
      posenetAnalysisTime = posenetAnalysisTime * 0.9 + took * 0.1;
      if (took > 250) {
        console.log("Took %d ms (avg %d ms)", took, posenetAnalysisTime); // console.log(result); 
      }
      if (posenetAnalysisTime > 500) {
	clearTimeout(posenetResultTimer);
        posenetResultTimer = 0;
      }
      //console.log("Present: %s", evaluatePresent(result));
      const position = evaluatePosition(result);

      if (drawPosenetResults) {
	drawResults($('#self-container'), result);
      }

      if (position.far) {
	synthesizing = true;
      } else {
	synthesizing = false;
      }

      if (position.far) {
        personDistance = 'far';
      } else if (position.present) {
        personDistance = 'near';
      } 

      if (personDistance == 'near') {
        $('.inner').addClass('near').removeClass('far');
        scrollToBottom();
      }
      if (personDistance == 'far') {
        $('.inner').addClass('far').removeClass('near');
        scrollToBottom();
      }

      position.motion = evaluateMotion(result, videoElement.width / 80);

      if (JSON.stringify(position) != JSON.stringify(personPosition) || start >= lastPosenetSend + 4500) {
	personPosition = position;
	tajSend({ position: position, captured: start, 
                      height: $('#self').prop('height'), width: $('#self').prop('width'), result: result });
        lastPosenetSend = start;
      }
    });
  }
};
startPosenetResultTimer();
});

var previousMotionPosition;

function evaluateMotion(result, noMovePix) {
  if (previousMotionPosition == null) {
    previousMotionPosition = result;
    return -1;
  }

  var consecStill = previousMotionPosition.consec;

  // See if any points have changed significantly
  const newPoints = result.keypoints;
  const prevPoints = previousMotionPosition.keypoints;
  var moved = 0;
  var seen = 0;
  for (var i = 0; i < 17; i++) {
    if (newPoints[i].score > THRESHOLD) {
      seen++;
    }
    if (pointMoved(newPoints[i], prevPoints[i], noMovePix)) {
      //console.log("new=" + JSON.stringify(newPoints[i]) + " prev=" + JSON.stringify(prevPoints[i]));
      moved++;
    } else if (i < 3) {
      // console.log("NOMOVE new=" + JSON.stringify(newPoints[i]) + " prev=" + JSON.stringify(prevPoints[i]) + " nomove=" + noMovePix);
    }
  }

  previousMotionPosition = result;
  if (seen < 3) {
    moved = moved | 0x80;
  }

  if (!moved) {
    consecStill++;
    //console.log("Still");
  } else {
    consecStill = 0;
  }

  previousMotionPosition.consec = consecStill;

  if (consecStill >= 8) {
    //console.log("Reported still");
    return 0;
  }

  return 0x100 | moved;
}

function pointMoved(newPoint, prevPoint, noMovePix) {
  if (Math.abs(newPoint.score - prevPoint.score) > 0.2) {
    return true;
  }

  if (newPoint.score < M_THRESHOLD || prevPoint.score < M_THRESHOLD) {
    return false;
  }
  if (Math.abs(newPoint.position.x - prevPoint.position.x) > noMovePix) {
    return true;
  }
  if (Math.abs(newPoint.position.y - prevPoint.position.y) > noMovePix) {
    return true;
  }
  return false;
}

function startPosenetResultTimer() {
  if (posenetResultTimer) {
    clearTimeout(posenetResultTimer);
  }
  posenetResultTimer = setInterval(posenetResultFunction, motionDetector ? 300 : 1000);
}

function takePhoto(name) {
  getSnapshot(function (data) {
    sendDataAs('images', name, data);
  });
}

function takeVideo(name, duration) {
  if (!name) {
    // Stop the current video
    videoCapture.stop();
    return;
  }
  getVideo(function (data) {
    sendDataAs('videos', name, data);
  }, duration);
}

function convertBlobToDataUrl(blob, done) {
  var a = new FileReader();
  a.onload = function (e) { done(e.target.result); };
  a.readAsDataURL(blob);
}

function getVideo(done, duration) {
  if (!videoCapture) {
    done();
  } else {
    $('#reclight').show();
    videoCapture.start(1000);
    videoCapture.ondataavailable = function (event) {
      convertBlobToDataUrl(event.data, done);
    };
    videoCapture.onstop = function(event) { $('#reclight').hide(); done(null); };
    if (duration) {
      setTimeout(function() {
	videoCapture.stop();
      }, duration);
    }
  }
}

function getSnapshot(done) {
  if (!imageCapture) {
    done();
  } else {
    imageCapture.takePhoto().then(blob => {
      getCompressedImageURL(blob, done);
    }).catch(done);
  }
}

function setMotionDetector(enable) {
  if (motionDetector != enable) {
    motionDetector = enable;
    startPosenetResultTimer();
    previousMotionPosition = null;
  }
}

function videoStart() {
  checkMediaDevices();
}
