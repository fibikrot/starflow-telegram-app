const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const starsRoutes = require('./routes/stars');
const gamesRoutes = require('./routes/games');
const web3Routes = require('./routes/web3');
const telegramRoutes = require('./routes/telegram');
const adminRoutes = require('./routes/admin');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./middleware/logger');

// Import services
const TelegramService = require('./services/telegramService');
const Web3Service = require('./services/web3Service');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Слишком много запросов, попробуйте позже'
  }
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Custom middleware
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', authMiddleware, userRoutes);
app.use('/api/stars', authMiddleware, starsRoutes);
app.use('/api/games', authMiddleware, gamesRoutes);
app.use('/api/web3', authMiddleware, web3Routes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/admin', adminRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('🔌 Пользователь подключился:', socket.id);
  
  socket.on('join-room', (userId) => {
    socket.join(`user-${userId}`);
    console.log(`👤 Пользователь ${userId} присоединился к комнате`);
  });
  
  socket.on('disconnect', () => {
    console.log('❌ Пользователь отключился:', socket.id);
  });
});

// Make io available to routes
app.set('io', io);

// Error handling middleware (должен быть последним)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint не найден',
    path: req.originalUrl
  });
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/starflow', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Подключение к MongoDB успешно');
})
.catch((error) => {
  console.error('❌ Ошибка подключения к MongoDB:', error);
  process.exit(1);
});

// Initialize services
const telegramService = new TelegramService();
const web3Service = new Web3Service();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Получен сигнал SIGTERM, завершаем работу...');
  server.close(() => {
    console.log('✅ HTTP сервер закрыт');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB соединение закрыто');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('🔄 Получен сигнал SIGINT, завершаем работу...');
  server.close(() => {
    console.log('✅ HTTP сервер закрыт');
    mongoose.connection.close(false, () => {
      console.log('✅ MongoDB соединение закрыто');
      process.exit(0);
    });
  });
});

server.listen(PORT, () => {
  console.log(`🚀 StarFlow сервер запущен на порту ${PORT}`);
  console.log(`🌍 Окружение: ${process.env.NODE_ENV}`);
  console.log(`📡 Socket.io готов к подключениям`);
}); 