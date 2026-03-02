import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
app.use(cors());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

interface Room {
  users: Map<string, User>;
  strokes: Stroke[];
}

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  userId: string;
}

interface DrawingData {
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
}

const rooms = new Map<string, Room>();

const generateColor = () => {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  return colors[Math.floor(Math.random() * colors.length)];
};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId: string, userName: string) => {
    socket.join(roomId);
    
    if (!rooms.has(roomId)) {
      rooms.set(roomId, { users: new Map(), strokes: [] });
    }
    
    const room = rooms.get(roomId)!;
    const user: User = {
      id: socket.id,
      name: userName || `User ${room.users.size + 1}`,
      color: generateColor()
    };
    
    room.users.set(socket.id, user);
    
    socket.emit('room-joined', {
      userId: socket.id,
      user,
      existingStrokes: room.strokes,
      users: Array.from(room.users.values())
    });
    
    socket.to(roomId).emit('user-joined', user);
    
    console.log(`${user.name} joined room ${roomId}`);
  });

  socket.on('drawing', (roomId: string, data: DrawingData) => {
    const room = rooms.get(roomId);
    if (room) {
      const stroke: Stroke = {
        points: data.points,
        color: data.color,
        width: data.width,
        tool: data.tool,
        userId: socket.id
      };
      room.strokes.push(stroke);
      
      socket.to(roomId).emit('drawing', {
        ...data,
        userId: socket.id
      });
    }
  });

  socket.on('cursor-move', (roomId: string, cursor: { x: number; y: number }) => {
    const room = rooms.get(roomId);
    if (room) {
      const user = room.users.get(socket.id);
      if (user) {
        user.cursor = cursor;
        socket.to(roomId).emit('cursor-move', {
          userId: socket.id,
          user,
          cursor
        });
      }
    }
  });

  socket.on('clear-canvas', (roomId: string) => {
    const room = rooms.get(roomId);
    if (room) {
      room.strokes = [];
      socket.to(roomId).emit('clear-canvas');
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    rooms.forEach((room, roomId) => {
      if (room.users.has(socket.id)) {
        const user = room.users.get(socket.id);
        room.users.delete(socket.id);
        
        if (room.users.size === 0) {
          rooms.delete(roomId);
        } else {
          io.to(roomId).emit('user-left', socket.id);
        }
        
        console.log(`${user?.name} left room ${roomId}`);
      }
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
