if(!location.hash) {
    location.hash = Math.floor(Math.random() * 0xFFFFFF).toString(16);
  }
  const roomHash = location.hash.substring(1);
  
  const roomName = 'observable-' + roomHash;
  const configuration = {
    iceServers: [{
      urls: 'stun:stun.l.google.com:19302'
    }],
  };
  
  let nodeID;
  let leftChildID = null;
  let rightChildID = null;
  let parentNodeID;
  let isPresenter; //to be used in future
  let isTeacher; //primary presenter
  let connections = []; //can also use string keys like "parent", "left" instead of ids
  let presenterStream = null;

  const socket = io.connect(); 
  pageReady();
  
  function onSuccess() {};
  
  function onError(error) {
    console.error(error);
  };
  
  function setupParentNode(id) {
    connections[id] = new RTCPeerConnection(configuration);

    connections[id].onicecandidate = event => {
      if (event.candidate) {
          sendMessage({'candidate': event.candidate}, "candidate", id);
      }
    };
  
    connections[id].ontrack = event => {
        const recievedStream = event.streams[0];
        console.log("recieved stream from parent->", recievedStream);
        console.log(remoteVideo.srcObject, remoteVideo);
        console.log(recievedStream.getTracks());
        if (!remoteVideo.srcObject || remoteVideo.srcObject.id !== recievedStream.id) {
            remoteVideo.srcObject = recievedStream;
          }
  
        if(presenterStream==null) {
          presenterStream = recievedStream;
        }
    };
  }
  
  function setupChildNeighbour(id) {
      connections[id] = new RTCPeerConnection(configuration);
      console.log("presenterStream in child setup", presenterStream);
      if(presenterStream!=null) {
          presenterStream.getTracks().forEach(track => connections[id].addTrack(track, presenterStream));
      }
  
      connections[id].onicecandidate = event => {
          if (event.candidate) {
              sendMessage({'candidate': event.candidate}, "candidate", id);
          }
      };
  
      connections[id].ontrack = event => {
          const recievedStream = event.streams[0];
          console.log("recieved stream from child", recievedStream);
      };
  }
  
  function sendMessage(msg, msgType, id) {
    let newMessage = {
      sourceID: nodeID,
      destinationID : id,
      type: msgType,
      room : roomName,
      message: msg
    }
    console.log("sending-> ",newMessage);
    socket.emit('message', newMessage);
  }
    
  function sendOffer(id) {
    connections[id].createOffer().then(function(description) {
      connections[id].setLocalDescription(description).then(function() {
        sendMessage({'sdp': connections[id].localDescription}, "sdp", id);
      }).catch(onError);
    }); 
  }
  
  function pageReady() { 
      socket.on('connecty', function() {
          socket.emit('create/join', roomName); //send roomName to server
      });
  
      socket.on('created/joined', function(data) { //get currentId from server
        console.log(data);
          nodeID = data.nodeID;
          parentNodeID = data.parentID; //let -1 be default 
  
          if(parentNodeID!=-1) {
              setupParentNode(parentNodeID);
  
              //send member_ready message to parent
              sendMessage("memberReady", "memberReady", parentNodeID);
          }
  
          if(nodeID==0 || parentNodeID==-1) { // or parent is neg
              isTeacher = true; //temporarily making 0 as teacher
          }

          if(isTeacher) {
            navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
              }).then(stream => {
    
                localVideo.srcObject = stream;
                presenterStream = stream;
                console.log("stream from presneter funcn",presenterStream);
            });
        }
      });
      
      socket.on('message', function(data) {
          console.log("recieved -> ", data);
          let senderID = data.sourceID;
          let intendedRecieverID = data.destinationID;
  
          if(nodeID != intendedRecieverID) {
              return;
          }
  
          /**
           * Type: memberReady -> Recieved ready message from child
           * Action: setup connection object and send offer to that child
           */
          
           //should take left or right from server
          if(data.type=="memberReady") {
  
              if(leftChildID == null) {
                  console.log("setting up left child");
                  leftChildID = senderID;
                  setupChildNeighbour(leftChildID);
              }
              else {
                console.log("setting up right child");
                  rightChildID = senderID;
                  setupChildNeighbour(rightChildID);
              }
  
              sendOffer(senderID);
          }
  
          /**
           * Type: sdp
           * Action: if it is an offer, create and send an answer back
           */
  
          if(data.type=="sdp") {
              let message = data.message;
              console.log(senderID);
              connections[senderID].setRemoteDescription(new RTCSessionDescription(message.sdp), () => {
                  if (connections[senderID].remoteDescription.type === 'offer') {
                      connections[senderID].createAnswer().then(function(description) {
                          connections[senderID].setLocalDescription(description).then(function() {
                          sendMessage({'sdp': connections[senderID].localDescription}, "sdp", senderID);
                          }).catch(onError);
                      });
                  }
              }, onError);
          }
  
          /**
           * Type: candidate
           * Action: add the recieved iceCandidate
           */
          if(data.type=="candidate") {
              let message = data.message;
              connections[senderID].addIceCandidate(
                  new RTCIceCandidate(message.candidate), onSuccess, onError
              );
          }
  
      });
  
  }