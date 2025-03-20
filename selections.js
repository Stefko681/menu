const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

/**
 * @route   GET /api/selections
 * @desc    Извличане на селекциите на потребителя
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  const { menu_id } = req.query;

  try {
    // Извличане на деца, свързани с профила на потребителя
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('children')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({
        success: false,
        message: 'Профилът не е намерен.'
      });
    }

    // Проверка дали потребителят има регистрирани деца
    if (!userProfile.children || userProfile.children.length === 0) {
      return res.status(200).json({
        success: true,
        selections: [],
        message: 'Няма регистрирани деца.'
      });
    }

    const childrenIds = userProfile.children.map(child => child.id);

    // Извличане на менюто
    let menuQuery = supabase.from('menus').select('*');
    if (menu_id) {
      menuQuery = menuQuery.eq('id', menu_id);
    } else {
      menuQuery = menuQuery.order('week_start', { ascending: false }).limit(1);
    }
    
    const { data: menuData, error: menuError } = await menuQuery.single();

    if (menuError) {
      return res.status(404).json({
        success: false,
        message: 'Менюто не е намерено.'
      });
    }

    // Извличане на селекциите за децата на потребителя
    const { data: selections, error: selectionsError } = await supabase
      .from('selections')
      .select('*')
      .eq('menu_id', menuData.id)
      .in('student_id', childrenIds);

    if (selectionsError) {
      return res.status(500).json({
        success: false,
        message: 'Грешка при извличане на селекциите.'
      });
    }

    res.status(200).json({
      success: true,
      menu: menuData,
      selections
    });
  } catch (error) {
    console.error('Грешка при извличане на селекциите:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при извличане на селекциите.'
    });
  }
});

/**
 * @route   POST /api/selections
 * @desc    Създаване или обновяване на селекция за хранене
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res) => {
  const { menu_id, student_id, day, meal_type, special_requirements } = req.body;

  if (!menu_id || !student_id || !day || !meal_type) {
    return res.status(400).json({
      success: false,
      message: 'Моля, предоставете всички необходими данни.'
    });
  }

  try {
    // Проверка дали детето принадлежи на потребителя
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('children')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({
        success: false,
        message: 'Профилът не е намерен.'
      });
    }

    const childrenIds = userProfile.children.map(child => child.id);
    if (!childrenIds.includes(student_id)) {
      return res.status(403).json({
        success: false,
        message: 'Нямате права да управлявате хранения за този ученик.'
      });
    }

    // Проверка за съществуваща селекция
    const { data: existingSelection, error: fetchError } = await supabase
      .from('selections')
      .select('id')
      .eq('menu_id', menu_id)
      .eq('student_id', student_id)
      .eq('day', day)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Грешка, когато не е намерен запис
      console.error('Грешка при проверка за съществуваща селекция:', fetchError);
    }

    let result;

    if (existingSelection) {
      // Обновяване на съществуваща селекция
      result = await supabase
        .from('selections')
        .update({
          meal_type,
          special_requirements,
          updated_at: new Date()
        })
        .eq('id', existingSelection.id)
        .select();
    } else {
      // Създаване на нова селекция
      result = await supabase
        .from('selections')
        .insert([
          {
            menu_id,
            student_id,
            day,
            date: new Date(), // Тук трябва да се изчисли реалната дата според деня от менюто
            meal_type,
            special_requirements,
            parent_id: req.user.id
          }
        ])
        .select();
    }

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: 'Грешка при запазване на селекцията.'
      });
    }

    res.status(201).json({
      success: true,
      message: existingSelection ? 'Селекцията е обновена успешно.' : 'Селекцията е създадена успешно.',
      selection: result.data[0]
    });
  } catch (error) {
    console.error('Грешка при запазване на селекцията:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при запазване на селекцията.'
    });
  }
});

/**
 * @route   DELETE /api/selections/:id
 * @desc    Изтриване на селекция за хранене
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    // Проверка дали селекцията съществува и принадлежи на потребителя
    const { data: selection, error: fetchError } = await supabase
      .from('selections')
      .select('id, student_id, menu_id')
      .eq('id', id)
      .single();

    if (fetchError) {
      return res.status(404).json({
        success: false,
        message: 'Селекцията не е намерена.'
      });
    }

    // Проверка дали детето принадлежи на потребителя
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('children')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({
        success: false,
        message: 'Профилът не е намерен.'
      });
    }

    const childrenIds = userProfile.children.map(child => child.id);
    if (!childrenIds.includes(selection.student_id)) {
      return res.status(403).json({
        success: false,
        message: 'Нямате права да управлявате тази селекция.'
      });
    }

    // Изтриване на селекцията
    const { error: deleteError } = await supabase
      .from('selections')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return res.status(400).json({
        success: false,
        message: 'Грешка при изтриване на селекцията.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Селекцията е изтрита успешно.'
    });
  } catch (error) {
    console.error('Грешка при изтриване на селекцията:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при изтриване на селекцията.'
    });
  }
});

/**
 * @route   GET /api/selections/students
 * @desc    Извличане на данните за децата на потребителя
 * @access  Private
 */
router.get('/students', authMiddleware, async (req, res) => {
  try {
    // Извличане на профила на потребителя с информация за децата
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('children')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      return res.status(404).json({
        success: false,
        message: 'Профилът не е намерен.'
      });
    }

    // Проверка дали потребителят има регистрирани деца
    if (!userProfile.children || userProfile.children.length === 0) {
      return res.status(200).json({
        success: true,
        students: [],
        message: 'Няма регистрирани деца.'
      });
    }

    res.status(200).json({
      success: true,
      students: userProfile.children
    });
  } catch (error) {
    console.error('Грешка при извличане на данни за учениците:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при извличане на данните за учениците.'
    });
  }
});

module.exports = router;
