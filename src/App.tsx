import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import './App.css';
import { Pencil, Eraser, Trash2, Palette, Minus, Circle, Download } from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface User {
  id: string;
  name: string;
  color: string;
  cursor?: Point;
}

interface DrawingData {
  points: Point[];
  color: string;
  width: number;
  tool: 'pen' | 'eraser';
  userId?: string;
}

const COLORS = [
  '#000000', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#FF8C94',
  '#6C5CE7', '#A29BFE', '#FD79A8', '#FDCB6E', '#E17055'
];

const BRUSH_SIZES = [2, 4, 8, 12, 16, 20];

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);
  const lastCursorEmitRef = useRef(0);
  const cursorThrottleMs = 50; // Throttle cursor updates for lower latency
  
  const [isConnected, setIsConnected] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userName, setUserName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(4);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBrushPicker, setShowBrushPicker] = useState(false);

  const redrawCanvas = useCallback((strokes: DrawingData[]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    strokes.forEach(stroke => {
      ctx.beginPath();
      ctx.strokeStyle = stroke.tool === 'eraser' ? '#FFFFFF' : stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      stroke.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();
    });
  }, []);

  // Set canvas to full window size
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }, []);

  useEffect(() => {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    const socket = io(socketUrl, {
      transports: ['websocket'], // Use websocket only for lower latency
      reconnectionDelay: 100,
      reconnectionDelayMax: 500
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('room-joined', (data: { 
      userId: string; 
      user: User; 
      existingStrokes: DrawingData[];
      users: User[];
    }) => {
      setCurrentUser(data.user);
      setUsers(data.users);
      resizeCanvas();
      redrawCanvas(data.existingStrokes);
    });

    socket.on('user-joined', (user: User) => {
      setUsers(prev => [...prev, user]);
    });

    socket.on('user-left', (userId: string) => {
      setUsers(prev => prev.filter(u => u.id !== userId));
    });

    socket.on('drawing', (data: DrawingData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.beginPath();
      ctx.strokeStyle = data.tool === 'eraser' ? '#FFFFFF' : data.color;
      ctx.lineWidth = data.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      data.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });

      ctx.stroke();
    });

    socket.on('clear-canvas', () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    socket.on('cursor-move', (data: { userId: string; user: User; cursor: Point }) => {
      setUsers(prev => 
        prev.map(u => u.id === data.userId ? { ...u, cursor: data.cursor } : u)
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [redrawCanvas, resizeCanvas]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  const joinRoom = () => {
    if (!roomId.trim() || !userName.trim()) return;
    socketRef.current?.emit('join-room', roomId.trim(), userName.trim());
    setHasJoined(true);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    isDrawingRef.current = true;
    currentStrokeRef.current = [{ x, y }];

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = tool === 'eraser' ? '#FFFFFF' : color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawingRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    currentStrokeRef.current.push({ x, y });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.lineTo(x, y);
    ctx.stroke();

    // Throttle cursor updates for better performance
    const now = Date.now();
    if (now - lastCursorEmitRef.current > cursorThrottleMs) {
      socketRef.current?.emit('cursor-move', roomId, { x, y });
      lastCursorEmitRef.current = now;
    }
  };

  const stopDrawing = () => {
    if (!isDrawingRef.current) return;
    
    isDrawingRef.current = false;
    
    if (currentStrokeRef.current.length > 0 && roomId) {
      socketRef.current?.emit('drawing', roomId, {
        points: currentStrokeRef.current,
        color,
        width: brushSize,
        tool
      });
    }
    
    currentStrokeRef.current = [];
  };

  const clearCanvas = () => {
    if (!roomId) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socketRef.current?.emit('clear-canvas', roomId);
  };

  const downloadPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const link = document.createElement('a');
    link.download = `collab-canvas-${roomId}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  if (!hasJoined) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Collaborative Canvas</h1>
          <p className="login-subtitle">Draw together in real-time with your friends</p>
          
          <div className="login-form">
            <div className="input-group">
              <label>Your Name</label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                placeholder="Enter your name"
                onKeyDown={(e) => e.key === 'Enter' && roomId && joinRoom()}
              />
            </div>
            
            <div className="input-group">
              <label>Room ID</label>
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter room ID or create new"
                onKeyDown={(e) => e.key === 'Enter' && userName && joinRoom()}
              />
            </div>
            
            <button
              onClick={joinRoom}
              disabled={!roomId.trim() || !userName.trim()}
              className="join-button"
            >
              Join Canvas
            </button>
          </div>
          
          <p className="login-hint">
            Use the same Room ID to draw with friends
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen-canvas">
      {/* Floating Toolbar - Overlay */}
      <div className="floating-toolbar">
        {/* Tool Selection */}
        <div className="tool-group">
          <button
            onClick={() => setTool('pen')}
            className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
            title="Pen"
          >
            <Pencil className="icon" />
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            title="Eraser"
          >
            <Eraser className="icon" />
          </button>
        </div>

        {/* Color Picker */}
        <div className="picker-container">
          <button
            onClick={() => {
              setShowColorPicker(!showColorPicker);
              setShowBrushPicker(false);
            }}
            className="picker-btn"
            title="Color"
          >
            <Palette className="icon" />
            <div 
              className="color-preview"
              style={{ backgroundColor: color }}
            />
          </button>
          
          {showColorPicker && (
            <div className="color-picker-dropdown">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setColor(c);
                    setShowColorPicker(false);
                  }}
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Brush Size */}
        <div className="picker-container">
          <button
            onClick={() => {
              setShowBrushPicker(!showBrushPicker);
              setShowColorPicker(false);
            }}
            className="picker-btn"
            title="Brush Size"
          >
            <Minus className="icon" />
            <Circle className="brush-preview" style={{ strokeWidth: brushSize / 2 }} />
          </button>
          
          {showBrushPicker && (
            <div className="brush-picker-dropdown">
              {BRUSH_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => {
                    setBrushSize(size);
                    setShowBrushPicker(false);
                  }}
                  className={`brush-option ${brushSize === size ? 'selected' : ''}`}
                >
                  <div 
                    className="brush-dot"
                    style={{ width: size, height: size }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="toolbar-divider" />

        {/* Download PNG */}
        <button onClick={downloadPNG} className="action-btn download-btn" title="Download PNG">
          <Download className="icon" />
        </button>

        {/* Clear Canvas */}
        <button onClick={clearCanvas} className="action-btn clear-btn" title="Clear Canvas">
          <Trash2 className="icon" />
        </button>
      </div>

      {/* Top Info Bar - Minimal */}
      <div className="info-bar">
        <div className="info-left">
          <span className="room-label">Room: {roomId}</span>
          <div className={`latency-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        </div>
        
        <div className="info-right">
          <div className="user-avatars-compact">
            {users.map(user => (
              <div
                key={user.id}
                className="user-avatar-mini"
                style={{ backgroundColor: user.color }}
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
          <span className="user-count-mini">{users.length}</span>
        </div>
      </div>

      {/* Fullscreen Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        className="fullscreen-drawing-canvas"
      />
      
      {/* Remote Cursors Overlay */}
      {users.filter(u => u.id !== currentUser?.id && u.cursor).map(user => (
        <div
          key={user.id}
          className="remote-cursor"
          style={{
            left: user.cursor!.x,
            top: user.cursor!.y
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill={user.color}>
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.35Z" />
          </svg>
          <span className="cursor-label" style={{ backgroundColor: user.color }}>
            {user.name}
          </span>
        </div>
      ))}
    </div>
  );
}

export default App;
