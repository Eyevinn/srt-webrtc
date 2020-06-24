const HOST = "http://localhost:3000/api/v1";
  
async function requestPeerConnection() {
  const response = await fetch(HOST + "/connections", { method: "POST" });
  const remotePeerConnection = await response.json();
  return remotePeerConnection;
}

document.addEventListener("DOMContentLoaded", () => {
  const remoteVideo = document.querySelector("video#example");
  remoteVideo.autoplay = true;
  remoteVideo.muted = true;

  const setup = async () => {
    const remotePeerConnection = await requestPeerConnection();
    const { id } = remotePeerConnection;

    const localPeerConnection = new RTCPeerConnection({
      sdpSemantics: 'unified-plan'
    });
    try {
      await localPeerConnection.setRemoteDescription(remotePeerConnection.localDescription);

      const remoteStream = new MediaStream(localPeerConnection.getReceivers().map(receiver => receiver.track));
      remoteVideo.srcObject = remoteStream;

      const originalAnswer = await localPeerConnection.createAnswer();
      const updatedAnswer = new RTCSessionDescription({
        type: 'answer',
        sdp: originalAnswer.sdp
      });
      await localPeerConnection.setLocalDescription(updatedAnswer);

      const response = await fetch(HOST + "/connections/" + id + "/remote-description", {
        method: "POST",
        body: JSON.stringify(localPeerConnection.localDescription),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log((await response.json()));
    } catch (exc) {
      localPeerConnection.close();
      throw exc;
    }
  };
  setup();
});
