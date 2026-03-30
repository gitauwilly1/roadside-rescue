const http = require('http');
const app = require('./app');
const connectDB = require('./config/database');
const socketIO = require('./socket');

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);

const io = socketIO.init(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Socket.io ready for real-time connections`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});