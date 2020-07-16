let isAlreadyCalling = false;
let getCalled = false;
let currentStream;
let current_audio_track;
let current_video_track;
let currentSocketId;
let inCall=false;

let remoteVideo = document.getElementById("remote-video");
let localVideo = document.getElementById("local-video");
const { RTCPeerConnection, RTCSessionDescription } = window;
let peerConnection = new RTCPeerConnection();
let main_username=getCookie("username");
if (main_username==undefined) {
  main_username=prompt("What is your name? ");
  document.cookie="username=" +main_username;
}
const existingCalls = [];


microphone_list=document.getElementById("microphone_list");
camera_list=document.getElementById("camera_list");
function unselectUsersFromList() {
  const alreadySelectedUser = document.querySelectorAll(
    ".active-user.active-user--selected"
  );

  alreadySelectedUser.forEach(el => {
    el.setAttribute("class", "active-user");
  });
}
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
peerConnection.onconnectionstatechange = function(event) {
 if (peerConnection.connectionState=="disconnected") {
   end_call();
 }
}
function createUserItemContainer(socketId,username) {
  const userContainerEl = document.createElement("div");

  const usernameEl = document.createElement("p");

  userContainerEl.setAttribute("class", "active-user");
  userContainerEl.setAttribute("id", socketId);
  usernameEl.setAttribute("class", "username");
  usernameEl.innerHTML = `Username: ${username}`;

  userContainerEl.appendChild(usernameEl);

  userContainerEl.addEventListener("click", () => {
    if (!inCall) {
      unselectUsersFromList();
      userContainerEl.setAttribute("class", "active-user active-user--selected");
      const talkingWithInfo = document.getElementById("talking-with-info");
      talkingWithInfo.innerHTML = `Talking with: "User: ${username}"`;
      callUser(socketId);
    }
  });

  return userContainerEl;
}

async function callUser(socketId) {
  console.log("calling " + socketId);
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(new RTCSessionDescription(offer));
  console.log("emitting call-user");
  socket.emit("call-user", {
    offer,
    to: socketId
  });
}

function updateUserList(socketIds) {
  const activeUserContainer = document.getElementById("active-user-container");
  for (key in socketIds) {
    username=socketIds[key];
    const alreadyExistingUser = document.getElementById(key);
    if (!alreadyExistingUser) {
      const userContainerEl = createUserItemContainer(key,username);
      activeUserContainer.appendChild(userContainerEl);
    }
  }
  
}
function end_call() {
  if (inCall) {
    peerConnection.close()
    remoteVideo.srcObject=null;
    isAlreadyCalling = false;
    getCalled = false;
     currentSocketId = null;
     inCall=false;
     peerConnection = new RTCPeerConnection();
     main();
}
}

function hangup() {
  socket.emit("end-call", {
    to: currentSocketId
  });
  end_call();
}

const socket = io.connect("https://video.suhas.net",{query:"username=" + main_username});

socket.on("update-user-list", ({ users }) => {
  console.log("receiving user-list");
  updateUserList(users);
});

socket.on("end-call", ({ socketId }) => {
    console.log("ending acll now");
    end_call();
});

socket.on("remove-user", ({ socketId }) => {
  console.log("receive remove-user");
  const elToRemove = document.getElementById(socketId);

  if (elToRemove) {
    elToRemove.remove();
  }
});

socket.on("call-made", async data => {
  console.log("receive call-made");
  let confirmed=false;
  if (getCalled == false && inCall == false) {
    confirmed = confirm(
      `User "Socket: ${data.socket}" wants to call you. Do accept this call?`
    );
  }
  
  if (confirmed || getCalled) {
    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(data.offer)
    );
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(new RTCSessionDescription(answer));
    console.log("emitting make-answer");
    socket.emit("make-answer", {
      answer,
      to: data.socket
    });
  }
  else {
    console.log("emitting reject-cal");
    socket.emit("reject-call", {
      from: data.socket
    });

    return;
  }
  if (getCalled) {
    getCalled=false;
    inCall=true;
    currentSocketId=data.socket;
  }
  else if (!getCalled) {
    getCalled=true;
  }
});

socket.on("answer-made", async data => {
  console.log("receive make-answer");
  await peerConnection.setRemoteDescription(
    new RTCSessionDescription(data.answer)
  );

  if (!isAlreadyCalling) {
    callUser(data.socket);
    isAlreadyCalling = true;
    inCall=true;
    currentSocketId=data.socket;
  }
});

socket.on("call-rejected", async data => {
  console.log("receive call-rejected");
  alert(`User: "Socket: ${data.socket}" rejected your call.`);
  unselectUsersFromList();
  isAlreadyCalling=false;
  getCalled=false;
});
function main() {
  peerConnection.ontrack = function({ streams: [stream] }) {
    console.log("new connection video trying");
    if (remoteVideo) {
      remoteVideo.srcObject = stream;
    }
  };
  audio_device=false;
video_device=false;
navigator.mediaDevices.enumerateDevices().then(devices => 
devices.forEach(device => {
  if (device.kind=="audioinput" && device.label != "") {
    audio_device=true;
  }
  if (device.kind=="videoinput" && device.label != "") {
    video_device=true;
  }
}))
if (audio_device == false && video_device == false) {
navigator.getUserMedia(
  { video: true, audio: true },
  stream => {
    if (localVideo) {
      localVideo.srcObject = stream;
    }
    currentStream=stream;
    stream.getTracks().forEach(track => {
      if (track.kind=="video") {
        current_video_track=peerConnection.addTrack(track,stream);
      }
      else if (track.kind=="audio") {
        current_audio_track=peerConnection.addTrack(track,stream);
      }
    })

    
    
  },
  error => {
    console.warn(error.message);
  }
);
}

navigator.mediaDevices.enumerateDevices().then(devices => 
devices.forEach(device => {
  new_option=document.createElement("option");
  new_option.value=device.deviceId;
  new_option.label=device.label;
  if (device.kind=="audioinput" && device.label!="") {
    microphone_list.appendChild(new_option);
  }
  if (device.kind=="videoinput" && device.label!="") {
    camera_list.appendChild(new_option);
  }
}))

function gotStream(stream) {
  if (stream.getTracks()[0].kind=="video") {
    current_video_track.replaceTrack(stream.getTracks()[0]);
    stream.addTrack(currentStream.getAudioTracks()[0]);
  }
  else {
    current_audio_track.replaceTrack(stream.getTracks()[0]);
    stream.addTrack(currentStream.getVideoTracks()[0]);
  }
  localVideo.srcObject = stream;
  currentStream = stream;
}
function audio_change() {
  let audioSource=microphone_list.value
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream);
    
}

function video_change() {
  let videoSource=camera_list.value
  const constraints = {
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream);
    
}
  
  unselectUsersFromList();
}

main();