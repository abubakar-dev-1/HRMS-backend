const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const Leave = require('../models/Leave');
const Department = require('../models/Department');

// @desc    Get dashboard stats
// @route   GET /api/v1/dashboard/stats
// @access  Private
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Employee stats
    const totalEmployees = await Employee.countDocuments({ status: { $ne: 'terminated' } });
    const activeEmployees = await Employee.countDocuments({ status: 'active' });

    // Attendance stats for today
    const presentToday = await Attendance.countDocuments({
      date: { $gte: today, $lt: tomorrow },
      status: 'present',
    });

    // Employees on leave today
    const onLeaveToday = await Leave.countDocuments({
      status: 'approved',
      startDate: { $lte: today },
      endDate: { $gte: today },
    });

    // Pending leave requests
    const pendingLeaves = await Leave.countDocuments({ status: 'pending' });

    // Department count
    const totalDepartments = await Department.countDocuments({ isActive: true });

    // Department-wise employee distribution
    const departmentStats = await Employee.aggregate([
      { $match: { status: { $ne: 'terminated' } } },
      { $group: { _id: '$departmentId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'departments',
          localField: '_id',
          foreignField: '_id',
          as: 'department',
        },
      },
      { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: { $ifNull: ['$department.name', 'Unassigned'] },
          count: 1,
          percentage: 1,
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Calculate percentages
    const deptWithPercentage = departmentStats.map((dept) => ({
      ...dept,
      percentage: totalEmployees > 0 ? Math.round((dept.count / totalEmployees) * 100) : 0,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        presentToday,
        onLeaveToday,
        pendingLeaves,
        totalDepartments,
        departmentStats: deptWithPercentage,
      },
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get recent activities
// @route   GET /api/v1/dashboard/activities
// @access  Private
exports.getRecentActivities = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent leaves
    const recentLeaves = await Leave.find()
      .populate('employeeId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    // Get recent attendance
    const recentAttendance = await Attendance.find({ clockIn: { $exists: true } })
      .populate('employeeId', 'firstName lastName')
      .sort({ clockIn: -1 })
      .limit(5)
      .lean();

    // Combine and format activities
    const activities = [];

    recentLeaves.forEach((leave) => {
      if (leave.employeeId) {
        activities.push({
          id: leave._id,
          user: `${leave.employeeId.firstName} ${leave.employeeId.lastName}`,
          action: leave.status === 'pending'
            ? 'requested leave'
            : `leave was ${leave.status}`,
          time: leave.updatedAt || leave.createdAt,
          type: 'leave',
        });
      }
    });

    recentAttendance.forEach((att) => {
      if (att.employeeId) {
        activities.push({
          id: att._id,
          user: `${att.employeeId.firstName} ${att.employeeId.lastName}`,
          action: att.clockOut ? 'clocked out' : 'clocked in',
          time: att.clockOut || att.clockIn,
          type: 'attendance',
        });
      }
    });

    // Sort by time and limit
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const limitedActivities = activities.slice(0, limit);

    res.status(200).json({
      success: true,
      data: limitedActivities,
    });
  } catch (error) {
    console.error('Recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get upcoming leaves
// @route   GET /api/v1/dashboard/upcoming-leaves
// @access  Private
exports.getUpcomingLeaves = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcomingLeaves = await Leave.find({
      status: 'approved',
      startDate: { $gte: today },
    })
      .populate({
        path: 'employeeId',
        select: 'firstName lastName departmentId',
        populate: { path: 'departmentId', select: 'name' },
      })
      .sort({ startDate: 1 })
      .limit(5)
      .lean();

    const formattedLeaves = upcomingLeaves.map((leave) => ({
      id: leave._id,
      name: leave.employeeId
        ? `${leave.employeeId.firstName} ${leave.employeeId.lastName}`
        : 'Unknown',
      department: leave.employeeId?.departmentId?.name || 'N/A',
      startDate: leave.startDate,
      endDate: leave.endDate,
      days: leave.totalDays,
      type: leave.leaveType,
    }));

    res.status(200).json({
      success: true,
      data: formattedLeaves,
    });
  } catch (error) {
    console.error('Upcoming leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
