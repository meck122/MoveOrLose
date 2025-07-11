// server/src/index.js (simplified)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors'); // Install: npm install cors

const app = express();
app.use(cors()); // Allow requests from React dev servers
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'], // Adjust ports if different
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

app.get('/', (req, res) => {
  // Simple HTTP route for testing
  res.send('<h1>Dance Game Server</h1>');
});

server.listen(PORT, () => {
  console.log(`Server listening on *:${PORT}`);
});
