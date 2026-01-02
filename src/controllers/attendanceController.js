const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');

// @desc    Get attendance records
// @route   GET /api/v1/attendance
// @access  Private
exports.getAttendance = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const { page = 1, limit = 10, date, employeeId, status } = req.query;
    const query = {};

    // If employee role, only show own attendance
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ email: req.user.email });
      if (employee) {
        query.employeeId = employee._id;
      }
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (status) {
      query.status = status;
    }

    const attendance = await Attendance.find(query)
      .populate('employeeId', 'firstName lastName email employeeCode departmentId')
      .sort({ date: -1, clockIn: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Attendance.countDocuments(query);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get today's attendance
// @route   GET /api/v1/attendance/today
// @access  Private
exports.getTodayAttendance = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let employeeId;
    if (req.query.employeeId) {
      employeeId = req.query.employeeId;
    } else if (req.user && req.user.employeeId) {
      // Handle populated object
      employeeId = typeof req.user.employeeId === 'object' ? req.user.employeeId._id : req.user.employeeId;
    } else if (req.user && req.user.email) {
      // Try to find by email
      const employee = await Employee.findOne({ email: req.user.email });
      employeeId = employee?._id;
    }

    const attendance = await Attendance.findOne({
      employeeId,
      date: { $gte: today, $lt: tomorrow },
    }).populate('employeeId', 'firstName lastName email employeeCode');

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Clock in
// @route   POST /api/v1/attendance/clock-in
// @access  Private
exports.clockIn = async (req, res) => {
  try {
    console.log('Clock in - req.user:', req.user ? { id: req.user._id, email: req.user.email, employeeId: req.user.employeeId } : 'undefined');

    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Get employeeId - handle both ObjectId and populated object
    let employeeId = req.body?.employeeId;

    if (!employeeId && req.user.employeeId) {
      // If employeeId is populated (object), get the _id
      employeeId = typeof req.user.employeeId === 'object' ? req.user.employeeId._id : req.user.employeeId;
    }

    if (!employeeId) {
      // Try to find employee by user's email
      const employee = await Employee.findOne({ email: req.user.email });
      employeeId = employee?._id;
    }

    console.log('Clock in - resolved employeeId:', employeeId);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile linked to your account. Please contact HR to link your employee profile.',
      });
    }

    // Create date at midnight UTC for consistent storage
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    console.log('Clock in attempt:', { employeeId, today: today.toISOString(), tomorrow: tomorrow.toISOString() });

    // Check if already clocked in today
    const existingAttendance = await Attendance.findOne({
      employeeId,
      date: { $gte: today, $lt: tomorrow },
    });

    console.log('Existing attendance:', existingAttendance);

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today',
      });
    }

    const attendance = await Attendance.create({
      employeeId,
      date: today,
      clockIn: now,
      status: 'present',
    });

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'firstName lastName email employeeCode');

    res.status(201).json({
      success: true,
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Clock in error:', error);

    // Handle duplicate key error from unique index
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked in today',
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Server error',
    });
  }
};

// @desc    Clock out
// @route   POST /api/v1/attendance/clock-out
// @access  Private
exports.clockOut = async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated',
      });
    }

    // Get employeeId - handle both ObjectId and populated object
    let employeeId = req.body?.employeeId;

    if (!employeeId && req.user.employeeId) {
      // If employeeId is populated (object), get the _id
      employeeId = typeof req.user.employeeId === 'object' ? req.user.employeeId._id : req.user.employeeId;
    }

    if (!employeeId) {
      // Try to find employee by user's email
      const employee = await Employee.findOne({ email: req.user.email });
      employeeId = employee?._id;
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile linked to your account. Please contact HR to link your employee profile.',
      });
    }

    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const attendance = await Attendance.findOne({
      employeeId,
      date: { $gte: today, $lt: tomorrow },
    });

    if (!attendance) {
      return res.status(400).json({
        success: false,
        message: 'No clock-in record found for today',
      });
    }

    if (attendance.clockOut) {
      return res.status(400).json({
        success: false,
        message: 'Already clocked out today',
      });
    }

    attendance.clockOut = now;

    // totalWorkHours is calculated automatically by the model's pre-save hook
    await attendance.save();

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'firstName lastName email employeeCode');

    res.status(200).json({
      success: true,
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Clock out error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get attendance stats
// @route   GET /api/v1/attendance/stats
// @access  Private
exports.getAttendanceStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const presentToday = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'present',
    });

    const totalEmployees = await Employee.countDocuments({
      status: { $ne: 'terminated' },
    });

    const absentToday = totalEmployees - presentToday;

    // Get this week's stats
    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const weeklyStats = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: startOfWeek, $lt: tomorrow },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: '$date' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        presentToday,
        absentToday,
        totalEmployees,
        attendanceRate: totalEmployees > 0
          ? Math.round((presentToday / totalEmployees) * 100)
          : 0,
        weeklyStats,
      },
    });
  } catch (error) {
    console.error('Get attendance stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create manual attendance entry
// @route   POST /api/v1/attendance
// @access  Private (Admin, HR)
exports.createAttendance = async (req, res) => {
  try {
    const { employeeId, date, clockIn, clockOut, status, notes } = req.body;

    const attendance = await Attendance.create({
      employeeId,
      date: new Date(date),
      clockIn: clockIn ? new Date(clockIn) : undefined,
      clockOut: clockOut ? new Date(clockOut) : undefined,
      status,
      notes,
    });

    // totalWorkHours is calculated automatically by the model's pre-save hook if both clockIn and clockOut are set

    const populatedAttendance = await Attendance.findById(attendance._id)
      .populate('employeeId', 'firstName lastName email employeeCode');

    res.status(201).json({
      success: true,
      data: populatedAttendance,
    });
  } catch (error) {
    console.error('Create attendance error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
