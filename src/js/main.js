'use strict'

/* Set up media stream constant and parameters */
const mediaStreamConstraints = {
  video: {
    facingMode: 'user',
    width: { min: 640, ideal: 1280, max: 1920 },
    height: { min: 360, ideal: 720, max: 1080 }
  },
  // audio: true,
}

const offerOptions = {
  offerToReceiveVideo: 1,
}

/* Definne initial start time of the call (defined as connection betweenn peers) */
let startTime = null

/* Video element where stream will be placed */
const localVideo = document.querySelector('#localVideo')
const remoteVideo = document.querySelector('#remoteVideo')

/* Streams that will be reproduced on the video, and PeerConnections */
let localStream,
  remoteStream,
  localPeerConnection,
  remotePeerConnection

/* Handles success by addinng the MediaStream to the video element */
function gotLocalMediaStream(mediaStream) {
  localStream = mediaStream
  if (!mediaStream) {
    localVideo.style.display = 'none'
  } else {
    localVideo.style.display = 'initial'
    localVideo.srcObject = mediaStream
  }
  trace('Receive local stream.')
  /* Enable call button */
  callButton.disabled = false
}

/* Handles error by logging a message to the console with error message */
function handleLocalMediaStreamError(error) {
  trace(`navigator.getUserMedia error: ${error.toString()}.`)
}

/* Handles remote MediaStream success by adding it as the remoteVideo src */
function gotRemoteMediaStream(event) {
  const mediaStream = event.stream
  remoteStream = mediaStream
  if (!mediaStream) {
    remoteVideo.style.display = 'none'
  } else {
    remoteVideo.style.display = 'initial'
    remoteVideo.srcObject = mediaStream
  }
  trace('Remote peer connection received remote stream.')
}

/* Logs a message with id and size of a video element */
function logVideoLoaded(event) {
  const video = event.target
  trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
    `videoHeight: ${video.videoHeight}px.`)
}

/* Logs a message with id and size of a video element */
/* This event is fired whe video begins streaming */
function logResizedVideo(event) {
  logVideoLoaded(event)

  if (startTime) {
    const elapsedTime = window.performance.now() - startTime
    startTime = null
    trace(`Setup time: ${elapsedTime.toFixed(3)}ms.`)
  }
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded)
remoteVideo.addEventListener('loadedmetadata', logVideoLoaded)
remoteVideo.addEventListener('onresize', logResizedVideo)

/* Connects with new peer candidate */
function handleConnection(event) {
  const peerConnection = event.target
  const iceCandidate = event.candidate

  if (iceCandidate) {
    const newIceCandidate = new RTCIceCandidate(iceCandidate)
    const otherPeer = getOtherPeer(peerConnection)

    otherPeer.addIceCandidate(newIceCandidate)
      .then(() => {
        handleConnectionSuccess(peerConnection)
      })
      .catch(error => {
        handleConnectionFailure(peerConnection, error)
      })

    trace(`${getPeerName(peerConnection)} ICE candidate:\n` +
      `${event.candidate.candidate}`)
  }
}

/* Logs that the connection succeeded */
function handleConnectionSuccess(peerConnection) {
  trace(`${getPeerName(peerConnection)} addIceCandidate success.`)
}

/* Logs that the connnection failed */
function handleConnectionFailure(peerConnection, error) {
  trace(`${getPeerName(peerConnection)} failed to add ICE Candidate:\n` +
    `${error.toString()}.`)
}

/* Logs changes to the connection state */
function handleConnectionChange(event) {
  const peerConnection = event.target
  console.log('ICE state change event:', event)
  trace(`${getPeerName(peerConnection)} ICE state: ` +
    `${peerConnection.iceConnectionState}.`)
}

/* Logs error when settig session description fails */
function setSessionDescriptionError(error) {
  trace(`Failed to create session description: ${error.toString()}.`)
}

/* Logs success when setting session description */
function setDescriptionSuccess(peerConnection, functionName) {
  const peerName = getPeerName(peerConnection)
  trace(`${peerName} ${functionName} complete.`)
}

/* Logs success when localDescription is set */
function setLocalDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setLocalDescription')
}

/* Logs success when remoteDescription is set */
function setRemoteDescriptionSuccess(peerConnection) {
  setDescriptionSuccess(peerConnection, 'setRemoteDescription')
}

/* Logs offer creation and sets peer connection session descriptions */
function createdOffer(description) {
  trace(`Offer from localPeerConnection:\n${description.sdp}`)

  trace('localPeerConnection setLocalDescription start.')
  localPeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(localPeerConnection)
    })
    .catch(setSessionDescriptionError)

  trace('remotePeerConnection setRemoteDescription start.')
  remotePeerConnection.setRemoteDescription(description)
    .then(() => {
      setRemoteDescriptionSuccess(remotePeerConnection)
    })
    .catch(setSessionDescriptionError)

  trace('remotePeerConnection createAnswer start.')
  remotePeerConnection.createAnswer()
    .then(createdAnswer)
    .catch(setSessionDescriptionError)
}

/* Logs answer to offer creation and sets peer connection session descriptions */
function createdAnswer(description) {
  trace(`Answer from remotePeerConnection:\n${description.sdp}.`)

  trace('remotePeerConnection setLocalDescription start.')
  remotePeerConnection.setLocalDescription(description)
    .then(() => {
      setLocalDescriptionSuccess(remotePeerConnection)
    })
    .catch(setSessionDescriptionError)

    trace('localPeerConnection setRemoteDescription start.')
    localPeerConnection.setRemoteDescription(description)
      .then(() => {
        setRemoteDescriptionSuccess(localPeerConnection)
      })
      .catch(setSessionDescriptionError)
}

/* Define action buttons */
const startButton = document.querySelector('#startButton')
const callButton = document.querySelector('#callButton')
const hangupButton = document.querySelector('#hangupButton')

/* Set up initial action buttons status: disable call and hangup */
callButton.disabled = true
hangupButton.disabled = true

/* Handles start button action: creates local MediaStream */
function startAction() {
  startAction.disabled = true
  navigator.mediaDevices
    .getUserMedia(mediaStreamConstraints)
    .then(gotLocalMediaStream)
    .catch(handleLocalMediaStreamError)
  trace('Requesting local stream.')
}
/* Handles stop button action: removes local MediaStream and disables the local Video */
function stopAction() {
  startAction.disabled = false
  const stream = localVideo.srcObject
  const tracks = localStream.getTracks()

  tracks.forEach(function(track) {
    track.stop()
  })

  localVideo.srcObject = null
}

/* Handles call button action: creates peer connection */
function callAction() {
  callButton.disabled = true
  hangupButton.disabled = false
  hangupButton.style.display = 'inline-grid'
  callButton.style.display = 'none'

  trace('Starting call.')
  startTime = window.performance.now()

  /* Get local media stream tracks. */
  const videoTracks = localStream.getVideoTracks()
  const audioTracks = localStream.getAudioTracks()
  if (videoTracks.length > 0) {
    trace(`Using video device: ${videoTracks[0].label}.`)
  }
  if (audioTracks.length > 0) {
    trace(`Using audio device: ${audioTracks[0].label}.`)
  }

  /* Allows for RTC server configuration */
  const servers = null

  /* Create peer connections and add behaviour */
  localPeerConnection = new RTCPeerConnection(servers)
  trace('Create local peer connection object localPeerConnection.')

  localPeerConnection.addEventListener('icecandidate', handleConnection)
  localPeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange)

  remotePeerConnection = new RTCPeerConnection(servers)
  trace('Created remote peer connection object remotePeerConnection.')

  remotePeerConnection.addEventListener('icecandidate', handleConnection)
  remotePeerConnection.addEventListener('iceconnectionstatechange', handleConnectionChange)
  remotePeerConnection.addEventListener('addstream', gotRemoteMediaStream)

  /* Add local stream to connection and create offer to connect */
  localPeerConnection.addStream(localStream)
  trace('Added local stream to localPeerConnection.')

  trace('localPeerConnection createOffer start.')
  localPeerConnection.createOffer(offerOptions)
    .then(createdOffer)
    .catch(setSessionDescriptionError)
}

/* Handles hangup action: ends up call, closes connections and resets peers */
function hangupAction() {
  localPeerConnection.close()
  remotePeerConnection.close()
  localPeerConnection = null
  remotePeerConnection = null
  hangupButton.disabled = true
  hangupButton.style.display = 'none'
  callButton.style.display = 'inline-grid'
  gotRemoteMediaStream({})
  callButton.disabled = false
  trace('Ending call.')
}

/* Add click event handlers for buttons */
// startButton.addEventListener('click', startAction)
callButton.addEventListener('click', callAction)
hangupButton.addEventListener('click', hangupAction)

/* Autostart the localVideo */
startButton.style.display = 'none'
startAction()

/* Gets the other "peer" connection */
function getOtherPeer(peerConnection) {
  return (peerConnection === localPeerConnection)
    ? remotePeerConnection
    : localPeerConnection
}

/* Gets the name of a certain peer connection */
function getPeerName(peerConnection) {
  return (peerConnection === localPeerConnection)
    ? 'localPeerConnection'
    : 'remotePeerConnection'
}

/* Logs an action (text) and the time when it happened on the console */
function trace(text) {
  text = text.trim()
  const now = (window.performance.now() / 1000).toFixed(3)

  console.log(now, text)
}
