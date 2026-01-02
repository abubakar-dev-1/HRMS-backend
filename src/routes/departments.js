const express = require('express');
const router = express.Router();
const {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} = require('../controllers/departmentController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.route('/')
  .get(getDepartments)
  .post(authorize('admin', 'hr'), createDepartment);

router.route('/:id')
  .get(getDepartment)
  .patch(authorize('admin', 'hr'), updateDepartment)
  .delete(authorize('admin'), deleteDepartment);

module.exports = router;
