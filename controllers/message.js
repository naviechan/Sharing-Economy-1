var Room = require('./room');  
var uuid = require('node-uuid');
var _ = require('underscore')._;

var people = {}, rooms= {};
var peopleCount = 0, roomCount = 0;
var sockets = [];
var messageHistory = {};

function purge(io, s, action) {
	/*
	The action will determine how we deal with the room/user removal.
	These are the following scenarios:
	if the user is the owner and (s)he:
		1) disconnects (i.e. leaves the whole server)
			- advise users
		 	- delete user from people object
			- delete room from rooms object
			- delete message history
			- remove all users from room that is owned by disconnecting user
		2) removes the room
			- same as above except except not removing user from the people object
		3) leaves the room
			- same as above
	if the user is not an owner and (s)he's in a room:
		1) disconnects
			- delete user from people object
			- remove user from room.people object
		2) removes the room
			- produce error message (only owners can remove rooms)
		3) leaves the room
			- same as point 1 except not removing user from the people object
	if the user is not an owner and not in a room:
		1) disconnects
			- same as above except not removing user from room.people object
		2) removes the room
			- produce error message (only owners can remove rooms)
		3) leaves the room
			- n/a
	*/
	if (people[s.id].inroom) { //user is in a room
		var room = rooms[people[s.id].inroom]; //check which room user is in.
		if (s.id === room.owner) { //user in room and owns room
			if (action === 'disconnect') {
				io.sockets.in(s.room).emit('update', 'The owner (' +people[s.id].name + ') has left the server. The room is removed and you have been disconnected from it as well.');
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete rooms[people[s.id].owns]; //delete the room
				delete people[s.id]; //delete user from people collection
				delete messageHistory[room.name]; //delete the message history
				peopleCount = _.size(people);
				var roomCount = _.size(rooms);
				io.emit('updatePeopleCount', {people: people, count: peopleCount});
				io.emit('updateRoomCount', {rooms: rooms, count: roomCount});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === 'removeRoom') { //room owner removes room
				io.sockets.in(s.room).emit('update', 'The owner (' +people[s.id].name + ') has removed the room. The room is removed and you have been disconnected from it as well.');
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete messageHistory[room.name]; //delete the message history
				roomCount = _.size(rooms);
				io.emit('updateRoomCount', {rooms: rooms, count: roomCount});
			} else if (action === 'leaveRoom') { //room owner leaves room
				io.sockets.in(s.room).emit('update', 'The owner (' +people[s.id].name + ') has left the room. The room is removed and you have been disconnected from it as well.');
				var socketids = [];
				for (var i=0; i<sockets.length; i++) {
					socketids.push(sockets[i].id);
					if(_.contains((socketids)), room.people) {
						sockets[i].leave(room.name);
					}
				}

				if(_.contains((room.people)), s.id) {
					for (var i=0; i<room.people.length; i++) {
						people[room.people[i]].inroom = null;
					}
				}
				delete rooms[people[s.id].owns];
				people[s.id].owns = null;
				room.people = _.without(room.people, s.id); //remove people from the room:people{}collection
				delete messageHistory[room.name]; //delete the message history
				roomCount = _.size(rooms);
				io.emit('updateRoomCount', {rooms: rooms, count: roomCount});
			}
		} else {//user in room but does not own room
			if (action === 'disconnect') {
				io.emit('update', people[s.id].name + ' has disconnected from the server.');
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					s.leave(room.name);
				}
				delete people[s.id];
				peopleCount = _.size(people);
				io.emit('updatePeopleCount', {people: people, count: peopleCount});
				var o = _.findWhere(sockets, {'id': s.id});
				sockets = _.without(sockets, o);
			} else if (action === 'removeRoom') {
				s.emit('update', 'Only the owner can remove a room.');
			} else if (action === 'leaveRoom') {
				if (_.contains((room.people), s.id)) {
					var personIndex = room.people.indexOf(s.id);
					room.people.splice(personIndex, 1);
					people[s.id].inroom = null;
					io.emit('update', people[s.id].name + ' has left the room.');
					s.leave(room.name);
				}
			}
		}	
	} else {
		//The user isn't in a room, but maybe he just disconnected, handle the scenario:
		if (action === 'disconnect') {
			io.emit('update', people[s.id].name + ' has disconnected from the server.');
			delete people[s.id];
			var peopleCount = _.size(people);
			io.emit('updatePeopleCount', {people: people, count: peopleCount});
			var o = _.findWhere(sockets, {'id': s.id});
			sockets = _.without(sockets, o);
		}		
	}
}

module.exports = (io) => {
    io.on('connection', (socket) => {
        socket.on('start', (name, device) => {
            var ownerRoomID = null;
            var inRoomID = null;

            var exists = _.find(people, (person) => {
                return person.name.toLowerCase() === name.toLowerCase();
            });

            if (exists) {
                socket.emit('nameExists', 'The username already exists. Please pick another one.');
            } else {
                people[socket.id] = {
                    'name' : name, 
                    'owns' : ownerRoomID, 
                    'inroom': inRoomID, 
                    'device': device
                };

                // connection msg
                socket.emit('update', 'You have connected to the server.');
                io.emit('update', people[socket.id].name + ' is online.');

                // update people and rooms
                peopleCount = _.size(people);
                roomCount = _.size(rooms);
                socket.emit('updateRoomCount', {
					rooms: rooms, 
					count: roomCount
				});
                io.emit('updatePeopleCount', {
					people: people, 
					count: peopleCount
				});
                
                // record socket
                sockets.push(socket);
            }
        });

        socket.on('getOnlinePeople', function(fn) {
                    fn({people: people});
            });

        socket.on('typing', function(data) {
            if (typeof people[socket.id] !== 'undefined') {
                io.sockets.in(socket.room).emit('isTyping', {isTyping: data, person: people[socket.id].name});
            }
                
        });
        
        socket.on('send', function(msTime, msg) {
            if (people[socket.id].inroom !== undefined ) {
                    io.sockets.in(socket.room).emit('message', msTime, people[socket.id], msg);
                    socket.emit('isTyping', false);
                    if (_.size(messageHistory[socket.room]) > 10) {
                        messageHistory[socket.room].splice(0,1);
                    } else {
                        messageHistory[socket.room].push(people[socket.id].name + ': ' + msg);
                    }
            } else {
            socket.emit('update', 'Please connect to a room.');
            }
            
        });
        
        socket.on('disconnect', function() {
            if (typeof people[socket.id] !== 'undefined') { //this handles the refresh of the name screen
                purge(io, socket, 'disconnect');
            }
        });

        //Room functions
        socket.on('createRoom', function(name) {
            if (people[socket.id].inroom) {
                socket.emit('update', 'You are in a room. Please leave it first to create your own.');
            } else if (!people[socket.id].owns) {
                var id = uuid.v4();
                var room = new Room(name, id, socket.id);
                rooms[id] = room;
                var roomCount = _.size(rooms);
                io.emit('updateRoomCount', {rooms: rooms, count: roomCount});
                //add room to socket, and auto join the creator of the room
                socket.room = name;
                socket.join(socket.room);
                people[socket.id].owns = id;
                people[socket.id].inroom = id;
                room.addPerson(socket.id);
                socket.emit('update', 'Welcome to ' + room.name + '.');
                socket.emit('sendRoomID', {id: id});
                messageHistory[socket.room] = [];
            } else {
                socket.emit('update', 'You have already created a room.');
            }
        });

        socket.on('check', function(name, fn) {
            var match = false;
            _.find(rooms, function(key,value) {
                if (key.name === name) {
                    return match = true;
                }	
            });
            fn({result: match});
        });

        socket.on('removeRoom', function(id) {
            var room = rooms[id];
            if (socket.id === room.owner) {
                purge(io, socket, 'removeRoom');
            } else {
                        socket.emit('update', 'Only the owner can remove a room.');
            }
        });

        socket.on('joinRoom', function(id) {
            if (typeof people[socket.id] !== 'undefined') {
                var room = rooms[id];
                if (socket.id === room.owner) {
                    socket.emit('update', 'You are the owner of this room and you have already been joined.');
                } else {
                    if (_.contains((room.people), socket.id)) {
                        socket.emit('update', 'You have already joined this room.');
                    } else {
                        if (people[socket.id].inroom !== null) {
                                socket.emit('update', 'You are already in a room ('+rooms[people[socket.id].inroom].name+'), please leave it first to join another room.');
                            } else {
                            room.addPerson(socket.id);
                            people[socket.id].inroom = id;
                            socket.room = room.name;
                            socket.join(socket.room);
                            var user = people[socket.id];
                            io.sockets.in(socket.room).emit('update', user.name + ' has connected to ' + room.name + ' room.');
                            socket.emit('update', 'Welcome to ' + room.name + '.');
                            socket.emit('sendRoomID', {id: id});
                            var keys = _.keys(messageHistory);
                            if (_.contains(keys, socket.room)) {
                                socket.emit('history', messageHistory[socket.room]);
                            }
                        }
                    }
                }
            } else {
                socket.emit('update', 'Please enter a valid name first.');
            }
        });

        socket.on('leaveRoom', function(id) {
            var room = rooms[id];
            if (room) {
                purge(io, socket, 'leaveRoom');
            }
        });
    });
    
};