const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route   POST /api/auth/register
 * @desc    Регистрация на нов потребител
 * @access  Public
 */
router.post('/register', async (req, res) => {
  const { email, password, firstName, lastName, role = 'parent' } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({
      success: false,
      message: 'Моля, попълнете всички задължителни полета.'
    });
  }

  try {
    // Регистрация на потребител в Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName
        }
      }
    });

    if (authError) {
      return res.status(400).json({
        success: false,
        message: authError.message
      });
    }

    // Създаване на профил в таблица profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: authData.user.id,
          first_name: firstName,
          last_name: lastName,
          email,
          role
        }
      ]);

    if (profileError) {
      console.error('Грешка при създаване на профил:', profileError);
      return res.status(500).json({
        success: false,
        message: 'Грешка при създаване на потребителски профил.'
      });
    }

    res.status(201).json({
      success: true,
      message: 'Потребителят е регистриран успешно. Моля, потвърдете имейл адреса си.'
    });
  } catch (error) {
    console.error('Грешка при регистрация:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при регистрацията.'
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Вход на потребител
 * @access  Public
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Моля, въведете имейл и парола.'
    });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        success: false,
        message: 'Невалидни данни за вход.'
      });
    }

    // Извличане на потребителска роля
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('Грешка при извличане на потребителски профил:', profileError);
    }

    res.status(200).json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        role: profileData?.role || 'parent'
      },
      session: {
        access_token: data.session.access_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (error) {
    console.error('Грешка при вход:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при входа в системата.'
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Изход от системата
 * @access  Private
 */
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(200).json({
      success: true,
      message: 'Успешен изход от системата.'
    });
  } catch (error) {
    console.error('Грешка при изход:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при изход от системата.'
    });
  }
});

/**
 * @route   GET /api/auth/profile
 * @desc    Извличане на потребителски профил
 * @access  Private
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    // Извличане на профилни данни от базата данни
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Профилът не е намерен.'
      });
    }

    res.status(200).json({
      success: true,
      profile: data
    });
  } catch (error) {
    console.error('Грешка при извличане на профил:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при извличане на профила.'
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Обновяване на потребителски профил
 * @access  Private
 */
router.put('/profile', authMiddleware, async (req, res) => {
  const { firstName, lastName, phone, address, children } = req.body;

  try {
    // Обновяване на профила в базата данни
    const { data, error } = await supabase
      .from('profiles')
      .update({
        first_name: firstName,
        last_name: lastName,
        phone,
        address,
        children,
        updated_at: new Date()
      })
      .eq('id', req.user.id)
      .select();

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Грешка при обновяване на профила.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Профилът е обновен успешно.',
      profile: data[0]
    });
  } catch (error) {
    console.error('Грешка при обновяване на профил:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при обновяване на профила.'
    });
  }
});

module.exports = router;
