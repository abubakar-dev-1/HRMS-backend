const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivities,
  getUpcomingLeaves,
} = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/stats', getDashboardStats);
router.get('/activities', getRecentActivities);
router.get('/upcoming-leaves', getUpcomingLeaves);

module.exports = router;
