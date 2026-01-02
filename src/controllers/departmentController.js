const Department = require('../models/Department');
const Employee = require('../models/Employee');

// @desc    Get all departments
// @route   GET /api/v1/departments
// @access  Private
exports.getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('headId', 'firstName lastName email')
      .sort({ name: 1 });

    // Get employee count for each department
    const departmentsWithCount = await Promise.all(
      departments.map(async (dept) => {
        const employeeCount = await Employee.countDocuments({
          departmentId: dept._id,
          status: { $ne: 'terminated' },
        });
        return {
          ...dept.toObject(),
          employeeCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: departmentsWithCount,
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get single department
// @route   GET /api/v1/departments/:id
// @access  Private
exports.getDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('headId', 'firstName lastName email');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Get employees in this department
    const employees = await Employee.find({
      departmentId: department._id,
      status: { $ne: 'terminated' },
    }).select('firstName lastName email employeeCode designationId')
      .populate('designationId', 'title');

    res.status(200).json({
      success: true,
      data: {
        ...department.toObject(),
        employees,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create department
// @route   POST /api/v1/departments
// @access  Private (Admin, HR)
exports.createDepartment = async (req, res) => {
  try {
    const department = await Department.create(req.body);

    res.status(201).json({
      success: true,
      data: department,
    });
  } catch (error) {
    console.error('Create department error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Department code already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update department
// @route   PATCH /api/v1/departments/:id
// @access  Private (Admin, HR)
exports.updateDepartment = async (req, res) => {
  try {
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('headId', 'firstName lastName email');

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    res.status(200).json({
      success: true,
      data: department,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Delete department
// @route   DELETE /api/v1/departments/:id
// @access  Private (Admin)
exports.deleteDepartment = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);

    if (!department) {
      return res.status(404).json({
        success: false,
        message: 'Department not found',
      });
    }

    // Check if department has employees
    const employeeCount = await Employee.countDocuments({
      departmentId: department._id,
      status: { $ne: 'terminated' },
    });

    if (employeeCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete department with ${employeeCount} active employees`,
      });
    }

    await department.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Department deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
