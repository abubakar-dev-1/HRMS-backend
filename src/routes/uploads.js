const express = require('express');
const router = express.Router();
const {
  uploadAvatar,
  uploadDocument,
  deleteDocument,
  deleteAvatar,
} = require('../controllers/uploadController');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Avatar routes
router.post('/avatar/:employeeId', uploadAvatar);
router.delete('/avatar/:employeeId', deleteAvatar);

// Document routes
router.post('/document/:employeeId', authorize('admin', 'hr'), uploadDocument);
router.delete('/document/:employeeId/:documentId', authorize('admin', 'hr'), deleteDocument);

module.exports = router;
