require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Създаване на Express приложение
const app = express();
const PORT = process.env.PORT || 5000;

// Supabase клиент
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(express.json());

// API маршрути
app.use('/api/auth', require('./routes/auth'));
app.use('/api/menu', require('./routes/menu'));
app.use('/api/selections', require('./routes/selections'));

// Тестов маршрут
app.get('/', (req, res) => {
  res.json({ message: 'API за управление на училищно хранене работи успешно!' });
});

// Стартиране на сървъра
app.listen(PORT, () => {
  console.log(`Сървърът работи на порт ${PORT}`);
});
