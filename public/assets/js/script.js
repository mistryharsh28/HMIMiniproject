const socket = io('/')
const videoGrid = document.getElementById('video-grid')
const screenShareDiv = document.getElementById('screen-share')
const myPeer = new Peer()
let isScreenShared = false
let myId;
let myVideoStream;
let screenStream;
const myVideo = document.createElement('video')
myVideo.muted = true;
const peers = {}
const screenPeers = {}
var recognition;
var is_muted = false;
var noteContent = [];


navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
}).then(stream => {

  try {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    if(language == "English"){
      recognition.lang = 'en';
    }
    else if (language == "Marathi"){
      recognition.lang = 'mr';

    }
    else if (language == "Hindi"){
      recognition.lang = 'hi';

    }
    else if (language == "Gujarati"){
      recognition.lang = 'gu';

    }
  }
  catch(e) {
    console.error(e);
  }

  myVideoStream = stream;
  
  addVideoStream(myVideo, stream);
  
  myPeer.on('call', call => {
    if(call.metadata.streamType=='video'){
      peers[call.metadata.caller] = call;
    }
    else{
      screenPeers[call.metadata.caller] = call;
    }
    call.answer(stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => {
      addVideoStream(video, userVideoStream)
      changeVideoDimension(Object.keys(peers).length+1)
    })
    call.on('close', () => {
      video.remove()
    })
  });

  recognition.onresult = function(event) {
    console.log("HeardSOmeting")

    var current = event.resultIndex;
  
    // Get a transcript of what was said.
    var transcript = event.results[current][0].transcript;
  
    // Add the current transcript to the contents of our Note.
    // There is a weird bug on mobile, where everything is repeated twice.
    // There is no official solution so far so we have to handle an edge case.
    var mobileRepeatBug = (current == 1 && transcript == event.results[0][0].transcript);
  
    // if(!mobileRepeatBug) {
    
    socket.emit('speech_recognised', user_email, transcript);

    noteContent.push(transcript);
// 
    // }

  };
  

  recognition.onstart = function() { 
    console.log("Speech Started");
  };
  
  recognition.onspeechend = function() {
      console.log("Speech Ended");
      recognition.stop();
  };
  
  recognition.onerror = function(event) {
    if(event.error == 'no-speech') {
      console.log('No speech was detected. Try again.');  
    }
    else{
      console.log(event.error);
    }
  };

  recognition.onsoundstart = function() {
    // console.log("Sound Start");
  };


  recognition.onsoundend = function() {
    // console.log("Sound End");
  };

  recognition.onend = function() {
    console.log("OnEnd");
    if(is_muted == false){
      recognition.start();
    }
  };

  recognition.start();

  socket.on('user-connected', userId => {
    connectToNewUser(userId, stream)
    if(isScreenShared==true){
      const call = myPeer.call(userId, screenStream, {metadata: {caller: myId, streamType: 'screenSharing'}})
      screenPeers[userId] = call
    }
  })
  // input value
  let text = $("input");
  // when press enter send message
  $('html').keydown(function (e) {
    if (e.which == 13 && text.val().length !== 0) {
      socket.emit('message', text.val());
      text.val('');
    }
  });

  socket.on("createMessage", (message, byUser) => {
    $(".messages").append(`<li class="message"><b>${byUser}</b><br/>${message}</li>`);
    scrollToBottom();
  });

});

socket.on('user-disconnected', userId => {
  if (peers[userId]) peers[userId].close()
})

socket.on('screen-shared', screen => {
  $("#video-grid").hide()
  screenShareDiv.append(screen)
})

socket.on('stop-shared-screen', userId => {
  if (screenPeers[userId]) screenPeers[userId].close()
})

myPeer.on('open', id => {
  socket.emit('join-room', ROOM_ID, id, user_email)
  myId = id
})

function connectToNewUser(userId, stream) {
  const call = myPeer.call(userId, stream, {metadata: {caller: myId, streamType: 'video'}})
  const video = document.createElement('video')
  call.on('stream', userVideoStream => {
    addVideoStream(video, userVideoStream)
  })
  call.on('close', () => {
    video.remove()
  })
  peers[userId] = call
  changeVideoDimension(Object.keys(peers).length+1)
}

function addVideoStream(video, stream) {
  video.srcObject = stream
  video.addEventListener('loadedmetadata', () => {
    video.play()
  })
  videoGrid.append(video)
}

function changeVideoDimension(no) {
  if(no>2){
    for(const vg of videoGrid.getElementsByTagName('video')){
      vg.style.height = '240px'
      vg.style.width = '320px'
    }
  }
}



const scrollToBottom = () => {
  var d = $('.main__chat_window');
  d.scrollTop(d.prop("scrollHeight"));
}

const muteUnmute = () => {
  const enabled = myVideoStream.getAudioTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getAudioTracks()[0].enabled = false;
    is_muted = true;
    recognition.stop();
    setUnmuteButton();
  } else {
    setMuteButton();
    myVideoStream.getAudioTracks()[0].enabled = true;
    is_muted = false;
    recognition.start();
  }
}

const playStop = () => {
  let enabled = myVideoStream.getVideoTracks()[0].enabled;
  if (enabled) {
    myVideoStream.getVideoTracks()[0].enabled = false;
    setPlayVideo()
  } else {
    setStopVideo()
    myVideoStream.getVideoTracks()[0].enabled = true;
  }
}

const setMuteButton = () => {
  const html = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setUnmuteButton = () => {
  const html = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `
  document.querySelector('.main__mute_button').innerHTML = html;
}

const setStopVideo = () => {
  const html = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const setPlayVideo = () => {
  const html = `
  <i class="stop fas fa-video-slash"></i>
    <span>Play Video</span>
  `
  document.querySelector('.main__video_button').innerHTML = html;
}

const leaveMeeting = () => {
  socket.disconnect(true)
}

var displayMediaOptions = {
  video: {
    cursor: 'always'
  },
  audio: true
}
const screen = document.createElement('video')

async function startCapture() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
    screen.srcObject = screenStream
    screen.addEventListener('loadedmetadata', () => {
      screen.play()
    })
    $("#video-grid").hide()
    screenShareDiv.append(screen)
    isScreenShared = true
    for(let peer in peers){
      if(peers[peer].open){
        const call = myPeer.call(peer, screenStream, {metadata: {caller: myId, streamType: 'screenSharing'}})
        screenPeers[peer] = call
      }
    }

    screenStream.oninactive = () => {
      $("#video-grid").show()
      screenShareDiv.remove(screen)
      socket.emit('stop-screen-share')
      for(let peer in peers){
        screenPeers[peer].close()
      }
      isScreenShared = false
    }
  } catch(err) {
    console.error("Error: " + err);
  }
}

function recordScreen(){
  const stop = document.getElementById('stop')
  const recordedVideo = document.getElementById('recorded-video')
  navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
    .then(stream => {
      let mediaRecorder = new MediaRecorder(stream)
      let chunks = []
      mediaRecorder.start()

      stop.onclick = () => {
        mediaRecorder.stop()
      }

      mediaRecorder.ondataavailable = (e) => {
        console.log('Recording')
        chunks.push(e.data)
      }

      mediaRecorder.onstop = () => {
        console.log('Inactive')
        let blob = new Blob(chunks, {'type': 'video/mp4'})
        chunks = []
        let videoURL = window.URL.createObjectURL(blob)
        recordedVideo.src = videoURL
        // const audio = new Audio(videoURL)
        // console.log(audio.textContent)
      }
    })
}