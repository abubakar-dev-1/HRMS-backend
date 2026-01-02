const Designation = require('../models/Designation');
const Employee = require('../models/Employee');

// @desc    Get all designations
// @route   GET /api/v1/designations
// @access  Private
exports.getDesignations = async (req, res) => {
  try {
    const { department, active } = req.query;
    const query = {};

    if (department) {
      query.departmentId = department;
    }

    if (active !== undefined) {
      query.isActive = active === 'true';
    }

    const designations = await Designation.find(query)
      .populate('departmentId', 'name code')
      .populate('employeeCount')
      .sort({ level: 1, title: 1 });

    res.status(200).json({
      success: true,
      data: designations,
      count: designations.length,
    });
  } catch (error) {
    console.error('Get designations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get single designation
// @route   GET /api/v1/designations/:id
// @access  Private
exports.getDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('employeeCount');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: designation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create designation
// @route   POST /api/v1/designations
// @access  Private (Admin, HR)
exports.createDesignation = async (req, res) => {
  try {
    const designation = await Designation.create(req.body);

    const populatedDesignation = await Designation.findById(designation._id)
      .populate('departmentId', 'name code');

    res.status(201).json({
      success: true,
      data: populatedDesignation,
    });
  } catch (error) {
    console.error('Create designation error:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Designation with this ${field} already exists`,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update designation
// @route   PATCH /api/v1/designations/:id
// @access  Private (Admin, HR)
exports.updateDesignation = async (req, res) => {
  try {
    const designation = await Designation.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('departmentId', 'name code');

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    res.status(200).json({
      success: true,
      data: designation,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `Designation with this ${field} already exists`,
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Delete designation
// @route   DELETE /api/v1/designations/:id
// @access  Private (Admin)
exports.deleteDesignation = async (req, res) => {
  try {
    const designation = await Designation.findById(req.params.id);

    if (!designation) {
      return res.status(404).json({
        success: false,
        message: 'Designation not found',
      });
    }

    // Check if any employees have this designation
    const employeesWithDesignation = await Employee.countDocuments({
      designationId: designation._id,
    });

    if (employeesWithDesignation > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete designation. ${employeesWithDesignation} employee(s) have this designation.`,
      });
    }

    await designation.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Designation deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
