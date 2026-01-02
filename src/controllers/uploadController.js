const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Employee = require('../models/Employee');

// Ensure upload directories exist
const uploadDir = path.join(__dirname, '../../uploads');
const avatarDir = path.join(uploadDir, 'avatars');
const documentsDir = path.join(uploadDir, 'documents');

[uploadDir, avatarDir, documentsDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'avatar') {
      cb(null, avatarDir);
    } else {
      cb(null, documentsDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'avatar') {
    // Only images for avatar
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatar'), false);
    }
  } else {
    // Documents: images, PDFs, DOC, DOCX
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: images, PDF, DOC, DOCX'), false);
    }
  }
};

// Multer upload configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// @desc    Upload employee avatar
// @route   POST /api/v1/uploads/avatar/:employeeId
// @access  Private (Admin, HR, Own profile)
exports.uploadAvatar = [
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a file',
        });
      }

      const employee = await Employee.findById(req.params.employeeId);
      if (!employee) {
        // Delete uploaded file
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Employee not found',
        });
      }

      // Delete old avatar if exists
      if (employee.avatar) {
        const oldPath = path.join(__dirname, '../../', employee.avatar);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      // Save new avatar path
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;
      employee.avatar = avatarUrl;
      await employee.save();

      res.status(200).json({
        success: true,
        data: {
          url: avatarUrl,
          filename: req.file.filename,
        },
      });
    } catch (error) {
      console.error('Upload avatar error:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Server error',
      });
    }
  },
];

// @desc    Upload employee document
// @route   POST /api/v1/uploads/document/:employeeId
// @access  Private (Admin, HR)
exports.uploadDocument = [
  upload.single('document'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Please upload a file',
        });
      }

      const employee = await Employee.findById(req.params.employeeId);
      if (!employee) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({
          success: false,
          message: 'Employee not found',
        });
      }

      const documentUrl = `/uploads/documents/${req.file.filename}`;
      const documentData = {
        name: req.body.name || req.file.originalname,
        type: req.body.type || 'other',
        url: documentUrl,
        uploadedAt: new Date(),
      };

      employee.documents.push(documentData);
      await employee.save();

      res.status(200).json({
        success: true,
        data: documentData,
      });
    } catch (error) {
      console.error('Upload document error:', error);
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({
        success: false,
        message: error.message || 'Server error',
      });
    }
  },
];

// @desc    Delete employee document
// @route   DELETE /api/v1/uploads/document/:employeeId/:documentId
// @access  Private (Admin, HR)
exports.deleteDocument = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    const document = employee.documents.id(req.params.documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found',
      });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../../', document.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from array
    employee.documents.pull(req.params.documentId);
    await employee.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Delete employee avatar
// @route   DELETE /api/v1/uploads/avatar/:employeeId
// @access  Private (Admin, HR, Own profile)
exports.deleteAvatar = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.employeeId);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    if (employee.avatar) {
      const filePath = path.join(__dirname, '../../', employee.avatar);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      employee.avatar = null;
      await employee.save();
    }

    res.status(200).json({
      success: true,
      message: 'Avatar deleted successfully',
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
