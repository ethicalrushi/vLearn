// getting dom elements
var divSelectRoom = document.getElementById("selectRoom");
var divConsultingRoom = document.getElementById("consultingRoom");
var inputRoomNumber = document.getElementById("roomNumber");
var btnGoRoom = document.getElementById("goRoom");
var localVideo = document.getElementById("localVideo");
var remoteVideo = {
    1:document.getElementById("remoteVideo1"),
    2:document.getElementById("remoteVideo2"),
    3:document.getElementById("remoteVideo3"),
    4:document.getElementById("remoteVideo4"),
    5:document.getElementById("remoteVideo5"),

}

// variables
var roomNumber;
var localStream;
var remoteStream = {};
var rtcPeerConnectionList = {};
var iceServers = {
    'iceServers': [
        { 'urls': 'stun:stun.services.mozilla.com' },
        { 'urls': 'stun:stun.l.google.com:19302' }
    ]
}
var streamConstraints = { audio: true, video: true };
var nodeId;
let peerList = {};

// Let's do this
var socket = io();


btnGoRoom.onclick = (event)=>{
    if(inputRoomNumber.value === ''){
        alert("please input a valid room number");
    }
    else{
        roomNumber = inputRoomNumber.value;
        socket.emit("create/join", roomNumber);
        divSelectRoom.style = "display: none;";
        divConsultingRoom.style = "display: block;";
    }
}

socket.on("created/joined", (event)=>{
    console.log(event)
})

socket.on("message", (event)=>{
    console.log(event);
})



socket.on('created', (room)=>{
    console.log('created event recieved');
    
    navigator.mediaDevices.getUserMedia(streamConstraints).then((stream)=>{
        nodeId = 1;
        localStream = stream;
        localVideo.srcObject = stream;
        console.log('stream', stream.getTracks())
    })
    .catch((err)=>{
        console.log("error while geting stream ", err);
    })
})

socket.on('joined', (obj)=>{
    let room = obj['room'];
    let srcid = obj['srcid'];
   
    console.log('joined event recieved');
    navigator.mediaDevices.getUserMedia(streamConstraints).then((stream)=>{
        localStream = stream;
        nodeId = srcid;
        localVideo.srcObject = stream;
        console.log('stream', stream.getTracks())
        console.log('emitting ready for room ', room, 'from node', srcid);
        socket.emit('message', {'type':'ready','room':room, 'srcid':nodeId});
    })
    .catch((err)=>{
        console.log("error while geting stream", err);
    })
})


socket.on('message', (obj)=>{
    console.log('message recieved at client', obj);
    execute_message(obj);
})

var execute_message = (obj)=>{
    console.log("execute message reached", obj)
    if(obj.type == 'ready'){
        let srcid = obj.srcid;
        if(nodeId!=srcid){
            let rtcPeerConnection;
            rtcPeerConnection = new RTCPeerConnection(iceServers);
            rtcPeerConnectionList[srcid] = rtcPeerConnection;

            rtcPeerConnectionList[srcid].onicecandidate = (event)=>{
                if (event.candidate) {
                    console.log('sending ice candidate');
                    socket.emit('message', {
                        'type':'candidate',
                        'srcid':nodeId,
                        'destid':srcid,
                        'room': roomNumber,
                        'event':{
                            type: 'candidate',
                            room:roomNumber,
                            label: event.candidate.sdpMLineIndex,
                            id: event.candidate.sdpMid,
                            candidate: event.candidate.candidate,
                            
                        }   
                        
                    })
                }
            };
        

            rtcPeerConnectionList[srcid].ontrack = (event)=>{
                remoteVideo[srcid].srcObject = event.streams[0];
                remoteStream[srcid] = event.stream;
            };
            rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[0], localStream);
            rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[1], localStream);
            console.log(localStream.getTracks())
            rtcPeerConnectionList[srcid].createOffer()
            .then((sdp)=>{
                rtcPeerConnectionList[srcid].setLocalDescription(sdp);
                console.log("Offer emitted from ", nodeId, ' to ', srcid);
                socket.emit("message", {
                    'type':'offer',
                    'remote_sdp' : sdp,
                    'type' : 'offer',
                    'room' : roomNumber,
                    'srcid' : nodeId,
                    'destid' : srcid,
                })            
            })
            .catch((err)=>{
                console.log("error on ready event", err);
            })
        }
    }

    else if(obj.type == 'offer'){
        let remote_sdp = obj['remote_sdp'];
        let srcid = obj.srcid;
        let destid = obj.destid;
        if(nodeId === destid){
            rtcPeerConnection = new RTCPeerConnection(iceServers);
            rtcPeerConnectionList[srcid] = rtcPeerConnection;
            rtcPeerConnectionList[srcid].onicecandidate = (event)=>{
                if (event.candidate) {
                    console.log('sending ice candidate');
                    socket.emit('message', {
                        'type':'candidate',
                        'srcid':destid,
                        'destid':srcid,
                        'room':roomNumber,
                        'event':{
                            type: 'candidate',
                            label: event.candidate.sdpMLineIndex,
                            id: event.candidate.sdpMid,
                            candidate: event.candidate.candidate,
                            room: roomNumber,
                        }
                    }); 
                    
                        
                    }
                };


            rtcPeerConnectionList[srcid].ontrack = (event)=>{
                remoteVideo[srcid].srcObject = event.streams[0];
                remoteStream[srcid] = event.stream;
            };

            rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[0], localStream);
            rtcPeerConnectionList[srcid].addTrack(localStream.getTracks()[1], localStream);
            console.log(localStream.getTracks())
            rtcPeerConnectionList[srcid].setRemoteDescription(new RTCSessionDescription(remote_sdp));
            rtcPeerConnectionList[srcid].createAnswer()
            .then((sdp)=>{
                rtcPeerConnectionList[srcid].setLocalDescription(sdp);
                console.log("Answer given from ", destid, ' to ', srcid);
                socket.emit("message", {
                    'type' : 'answer',
                    'sdp' : sdp,
                    'room' : roomNumber,
                    'srcid' : destid,
                    'destid' : srcid,
                })
            })
            .catch((err)=>{
                console.log("error occured while answering", err);
            })
        }
    }

    else if(obj.type=='candidate'){
        console.log("cand handled from client");
        console.log("nodeId is ", nodeId);
        console.log(obj)
        if(nodeId===obj.destid){
            let event = obj.event;
            let srcid = obj.srcid;
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: event.label,
                candidate: event.candidate
            });
            console.log(candidate)
            rtcPeerConnectionList[srcid].addIceCandidate(candidate).then((event)=>{
                console.log("iceCandidate added");
            }).catch((err)=>{
                console.log(err)
            }
                
            )
            

        }
        else{
            console.log("node id and dest id didnot match");
        }
    }

    else if(obj.type=='answer'){
        let sdp = obj.sdp;
        let srcid = obj.srcid;
        let destid = obj.destid;
        if(destid===nodeId){
            let peerConnection = rtcPeerConnectionList[srcid];
            peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        }
    
    }







}




var url = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf';

// Loaded via <script> tag, create shortcut to access PDF.js exports.
var pdfjsLib = window['pdfjs-dist/build/pdf'];

// The workerSrc property shall be specified.
pdfjsLib.GlobalWorkerOptions.workerSrc = '//mozilla.github.io/pdf.js/build/pdf.worker.js';



var pdf_aval = false;
var pdf_pg_no = 1;
var canvas = document.getElementById('the-canvas');
var pdf_obj;



var render_pdf_page = (pdf, pg_no)=>{
    pdf.getPage(pg_no).then(function(page) {
        console.log('Page loaded');
        
        var scale = 0.3;
        var viewport = page.getViewport({scale: scale});

        // Prepare canvas using PDF page dimensions
        var canvas = document.getElementById('the-canvas');
        var context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        var renderContext = {
        canvasContext: context,
        viewport: viewport
        };
        var renderTask = page.render(renderContext);
        renderTask.promise.then(function () {
        console.log('Page rendered');
        });
    });
}


var load_pdf = (doc)=>{
    var loadingTask = pdfjsLib.getDocument('demodoc.pdf');

    loadingTask.promise.then(function(pdf) {
    pdf_obj = pdf
    console.log('PDF loaded');
    
    // Fetch the first page
    render_pdf_page(pdf_obj, pdf_pg_no);
   
    }, function (reason) {
    // PDF loading error
    console.error(reason);
    });

}

var inc_pg_no = ()=>{
    pdf_pg_no=pdf_pg_no+1;
    render_pdf_page(pdf_obj, pdf_pg_no);
}
var dec_pg_no = ()=>{
    pdf_pg_no=pdf_pg_no-1;
    render_pdf_page(pdf_obj, pdf_pg_no);
}

