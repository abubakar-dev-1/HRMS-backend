const express = require('express');
const router = express.Router();
const {
  getAttendance,
  getTodayAttendance,
  clockIn,
  clockOut,
  getAttendanceStats,
  createAttendance,
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Stats and today routes
router.get('/stats', getAttendanceStats);
router.get('/today', getTodayAttendance);

// Clock in/out routes
router.post('/clock-in', clockIn);
router.post('/clock-out', clockOut);

// CRUD routes
router.route('/')
  .get(getAttendance)
  .post(authorize('admin', 'hr'), createAttendance);

module.exports = router;
