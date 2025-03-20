const supabase = require('../config/supabase');

// Middleware за проверка на автентикацията
const authMiddleware = async (req, res, next) => {
  // Проверка за съществуване на токен
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Достъпът е отказан. Не е предоставен токен за автентикация.' 
    });
  }

  try {
    // Проверка на JWT токена
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Невалиден или изтекъл токен за автентикация.'
      });
    }

    // Запазване на потребителската информация в обекта на заявката
    req.user = user;
    next();
  } catch (error) {
    console.error('Грешка при автентикация:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Вътрешна грешка на сървъра.' 
    });
  }
};

// Middleware за проверка на администраторски права
const adminMiddleware = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      success: false, 
      message: 'Потребителят не е автентикиран.' 
    });
  }

  try {
    // Извличане на потребителска роля от базата данни
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !data) {
      return res.status(500).json({ 
        success: false, 
        message: 'Грешка при проверка на потребителската роля.' 
      });
    }

    // Проверка за администраторски права
    if (data.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Нямате права за достъп до този ресурс.' 
      });
    }

    next();
  } catch (error) {
    console.error('Грешка при проверка на права:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Вътрешна грешка на сървъра.' 
    });
  }
};

module.exports = { authMiddleware, adminMiddleware };
