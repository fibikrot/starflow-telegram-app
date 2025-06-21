const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoURI = process.env.DATABASE_URL || 'mongodb://localhost:27017/starflow';
    
    console.log('🔌 Подключение к MongoDB...');
    
    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`✅ MongoDB подключен: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error('❌ Ошибка подключения к MongoDB:', error.message);
    
    // В режиме разработки продолжаем без БД
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ Продолжаем без базы данных (режим разработки)');
      return null;
    }
    
    // В продакшене завершаем процесс
    console.error('💥 Завершение работы из-за ошибки БД');
    process.exit(1);
  }
};

module.exports = connectDB; 