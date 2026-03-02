# Collaborative Canvas

A real-time collaborative drawing application where you and your friends can draw together on a shared canvas.

## Features

- **Real-time drawing** with WebSocket communication
- **Multiple users** can join the same room and draw simultaneously
- **Live cursor tracking** - see where other users are drawing
- **Drawing tools**: Pen and Eraser
- **Color picker** with 15 colors
- **Brush size** selector (2px to 20px)
- **Clear canvas** functionality
- **User avatars** and presence indicators

## Quick Start

### 1. Start the Backend Server

```bash
cd server
npm install
npm run dev
```

The server will start on port 3001.

### 2. Start the Frontend

In a new terminal:

```bash
npm install
npm run dev
```

The frontend will start on port 5173.

### 3. Open in Browser

Navigate to `http://localhost:5173` and:
1. Enter your name
2. Enter a room ID (or create a new one)
3. Click "Join Canvas"
4. Share the room ID with friends so they can join!

## How to Collaborate

1. Both you and your friends must use the **same Room ID**
2. Each user gets a unique color
3. Draw together in real-time!
4. See each other's cursors as they draw

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Node.js + Express + Socket.io
- **Styling**: Custom CSS with glassmorphism effects
- **Icons**: Lucide React

## Development

### Project Structure
```
collab-canvas/
├── src/
│   ├── App.tsx       # Main React component
│   ├── App.css       # Application styles
│   └── main.tsx      # Entry point
├── server/
│   ├── index.ts      # Socket.io server
│   └── package.json
├── package.json
└── README.md
```

### Environment Variables

For production deployment, you may want to set:
- `PORT` - Backend server port (default: 3001)

## License

MIT
