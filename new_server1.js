//requires
const express = require('express');
const app = express();
const path = require('path');
var http = require('http').Server(app);
var io = require('socket.io')(http);
const router = express.Router();

const port = process.env.PORT || 3000;

// express routing

var nodeList = {};
let nodeToRoomMapping = {};

app.get("/:roomId", (req, res)=>{
    io.on('connection', function (socket) {
        console.log('Connection request recieved');
        console.log("socket id : ", socket.id)
        socket.on("create/join", function () {  
            var room = req.params.roomId;     
            var myRoom = io.sockets.adapter.rooms[room] || { length: 0 };
            var numClients = myRoom.length;
            if (numClients === 0) {
                nodeList[room] = [socket.id];
                nodeToRoomMapping[socket.id] = room;
                socket.join(room);
                let response = {
                    'room': room,
                    'nodeId' : socket.id
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
                    'nodeId':socket.id,
                    'parentId':parentId,              
    
                }
                socket.emit('created/joined', response);
            }
        });
    
        socket.on('message', function(event){
            socket.broadcast.to(event.room).emit('message', event);
        });
    
        socket.on('disconnect', function(event){
            let currentRoomList = nodeList[nodeToRoomMapping[socket.id]]
            let disconnectedIndex = currentRoomList.findIndex(element => element == socket.id);
            currentRoomList[disconnectedIndex] = currentRoomList[currentRoomList.length-1];
            currentRoomList.pop();
        });
        
    
    });
    res.render(path.join(__dirname+"/public/index.html"))

})


// signaling


// listener
http.listen(port || 3000, function () {
    console.log('listening on', port);
});