const express = require('express');
const router = express.Router();
const {
  getLeaves,
  getLeave,
  createLeave,
  updateLeave,
  approveLeave,
  rejectLeave,
  deleteLeave,
  getLeaveStats,
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Stats route
router.get('/stats', getLeaveStats);

// Approval routes
router.patch('/:id/approve', authorize('admin', 'hr'), approveLeave);
router.patch('/:id/reject', authorize('admin', 'hr'), rejectLeave);

// CRUD routes
router.route('/')
  .get(getLeaves)
  .post(createLeave);

router.route('/:id')
  .get(getLeave)
  .patch(updateLeave)
  .delete(deleteLeave);

module.exports = router;
