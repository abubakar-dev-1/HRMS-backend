const express = require('express');
const router = express.Router();
const {
  getDesignations,
  getDesignation,
  createDesignation,
  updateDesignation,
  deleteDesignation,
} = require('../controllers/designationController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

router
  .route('/')
  .get(getDesignations)
  .post(authorize('admin', 'hr'), createDesignation);

router
  .route('/:id')
  .get(getDesignation)
  .patch(authorize('admin', 'hr'), updateDesignation)
  .delete(authorize('admin'), deleteDesignation);

module.exports = router;
