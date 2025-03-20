const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const { generateCsv, formatSelectionsForExport } = require('../utils/csvExport');

/**
 * @route   GET /api/menu
 * @desc    Извличане на текущото седмично меню
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    // Извлича най-новото меню от базата данни
    const { data, error } = await supabase
      .from('menus')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      return res.status(404).json({
        success: false,
        message: 'Няма намерено седмично меню.'
      });
    }

    res.status(200).json({
      success: true,
      menu: data
    });
  } catch (error) {
    console.error('Грешка при извличане на менюто:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при извличане на менюто.'
    });
  }
});

/**
 * @route   POST /api/menu
 * @desc    Създаване или обновяване на седмично меню
 * @access  Private (само за администратори)
 */
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { week_start, week_end, menu_data } = req.body;

  if (!week_start || !week_end || !menu_data) {
    return res.status(400).json({
      success: false,
      message: 'Моля, предоставете всички необходими данни за менюто.'
    });
  }

  try {
    // Проверка за съществуващо меню за този период
    const { data: existingMenu, error: fetchError } = await supabase
      .from('menus')
      .select('id')
      .eq('week_start', week_start)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Код, когато няма намерени записи
      console.error('Грешка при проверка за съществуващо меню:', fetchError);
    }

    let result;

    if (existingMenu) {
      // Обновяване на съществуващото меню
      result = await supabase
        .from('menus')
        .update({
          menu_data,
          updated_at: new Date(),
          updated_by: req.user.id
        })
        .eq('id', existingMenu.id)
        .select();
    } else {
      // Създаване на ново меню
      result = await supabase
        .from('menus')
        .insert([
          {
            week_start,
            week_end,
            menu_data,
            created_by: req.user.id
          }
        ])
        .select();
    }

    if (result.error) {
      return res.status(400).json({
        success: false,
        message: 'Грешка при запазване на менюто.'
      });
    }

    res.status(201).json({
      success: true,
      message: existingMenu ? 'Менюто е обновено успешно.' : 'Менюто е създадено успешно.',
      menu: result.data[0]
    });
  } catch (error) {
    console.error('Грешка при запазване на менюто:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при запазване на менюто.'
    });
  }
});

/**
 * @route   GET /api/menu/export
 * @desc    Експортиране на селекциите за менюто в CSV
 * @access  Private (само за администратори)
 */
router.get('/export', authMiddleware, adminMiddleware, async (req, res) => {
  const { menu_id, week_start, week_end } = req.query;

  if (!menu_id && (!week_start || !week_end)) {
    return res.status(400).json({
      success: false,
      message: 'Моля, предоставете menu_id или week_start и week_end.'
    });
  }

  try {
    // Извличане на менюто
    let menuQuery = supabase.from('menus').select('*');
    
    if (menu_id) {
      menuQuery = menuQuery.eq('id', menu_id);
    } else {
      menuQuery = menuQuery.eq('week_start', week_start);
    }
    
    const { data: menuData, error: menuError } = await menuQuery.single();

    if (menuError) {
      return res.status(404).json({
        success: false,
        message: 'Менюто не е намерено.'
      });
    }

    // Извличане на селекциите за това меню
    const { data: selections, error: selectionsError } = await supabase
      .from('selections')
      .select('*')
      .eq('menu_id', menuData.id);

    if (selectionsError) {
      return res.status(500).json({
        success: false,
        message: 'Грешка при извличане на селекциите.'
      });
    }

    if (selections.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Няма намерени селекции за това меню.'
      });
    }

    // Извличане на информация за учениците
    const studentIds = [...new Set(selections.map(s => s.student_id))];
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .in('id', studentIds);

    if (studentsError) {
      console.error('Грешка при извличане на ученици:', studentsError);
    }

    // Форматиране на данните за експорт
    const formattedData = formatSelectionsForExport(
      selections, 
      students || [], 
      menuData.menu_data
    );

    // Генериране на CSV
    const fields = [
      { label: 'Дата', value: 'date' },
      { label: 'Ден', value: 'day' },
      { label: 'Име на ученик', value: 'student_name' },
      { label: 'Клас', value: 'class' },
      { label: 'Тип хранене', value: 'meal_type' },
      { label: 'Описание на меню', value: 'menu_description' },
      { label: 'Специални изисквания', value: 'special_requirements' }
    ];

    const filename = `menu-selections-${menuData.week_start}-to-${menuData.week_end}.csv`;
    const { csv } = generateCsv(formattedData, fields, filename);

    // Връщане на CSV файла
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    console.error('Грешка при експортиране на данните:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при експортиране на данните.'
    });
  }
});

/**
 * @route   GET /api/menu/history
 * @desc    Извличане на историята на менютата
 * @access  Private (само за администратори)
 */
router.get('/history', authMiddleware, adminMiddleware, async (req, res) => {
  const { limit = 10, offset = 0 } = req.query;

  try {
    // Извличане на историята на менютата
    const { data, error, count } = await supabase
      .from('menus')
      .select('id, week_start, week_end, created_at', { count: 'exact' })
      .order('week_start', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Грешка при извличане на исторически данни.'
      });
    }

    res.status(200).json({
      success: true,
      menus: data,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Грешка при извличане на история на менютата:', error);
    res.status(500).json({
      success: false,
      message: 'Възникна грешка при извличане на историята на менютата.'
    });
  }
});

module.exports = router;
