//requires
const express = require('express');
const app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const port = process.env.PORT || 3000;

// express routing
app.use("/", express.static('public'));


var nodeList = {};
let nodeToRoomMapping = {};



// signaling
io.on('connection', function (socket) {
    console.log('Connection request recieved');
    console.log("socket id : ", socket.id)
    socket.emit('connecty');
    socket.on("create/join", function (room) {       
        var myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
        var numClients = myRoom.length;
        if (numClients === 0) {
            nodeList[room] = [socket.id];
            nodeToRoomMapping[socket.id] = room;
            socket.join(room);
            let response = {
                'room': room,
                'nodeID' : socket.id,
                'parentID': -1
            }
            socket.emit('created/joined', response);
        } 
        else{
            nodeList[room].push(socket['id']);   
            nodeToRoomMapping[socket['id']] = room;      
            socket.join(room);
            let parentId = nodeList[room][Math.floor((nodeList[room].length-2)/2)];
            let response = {
                'room': room,
                'nodeID':socket.id,
                'parentID':parentId,              

            }
            socket.emit('created/joined', response);
        }
    });

    socket.on('message', function(event){
        console.log(event);
        socket.broadcast.to(event.room).emit('message', event);
    });

    socket.on('disconnect', function(event){
        let currentRoomList = nodeList[nodeToRoomMapping[socket.id]]
        let disconnectedIndex = currentRoomList.findIndex(element => element == socket.id);
        currentRoomList[disconnectedIndex] = currentRoomList[currentRoomList.length-1];
        currentRoomList.pop();
    });
    

});

// listener
http.listen(port || 3000, function () {
    console.log('listening on', port);
});