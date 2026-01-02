const Employee = require('../models/Employee');
const User = require('../models/User');

// @desc    Get all employees
// @route   GET /api/v1/employees
// @access  Private
exports.getEmployees = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, department, status } = req.query;

    const query = {};

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { employeeCode: { $regex: search, $options: 'i' } },
      ];
    }

    if (department) {
      query.departmentId = department;
    }

    if (status) {
      query.status = status;
    }

    const employees = await Employee.find(query)
      .populate('departmentId', 'name code')
      .populate('designationId', 'title')
      .populate('managerId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Employee.countDocuments(query);

    res.status(200).json({
      success: true,
      data: employees,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get single employee
// @route   GET /api/v1/employees/:id
// @access  Private
exports.getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id)
      .populate('departmentId', 'name code')
      .populate('designationId', 'title')
      .populate('managerId', 'firstName lastName email');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create employee
// @route   POST /api/v1/employees
// @access  Private (Admin, HR)
exports.createEmployee = async (req, res) => {
  try {
    // Generate employee code
    const count = await Employee.countDocuments();
    const employeeCode = `EMP-${String(count + 1).padStart(4, '0')}`;

    // Check if employee already exists with this email (exclude terminated)
    const existingEmployee = await Employee.findOne({
      email: req.body.email.toLowerCase(),
      status: { $ne: 'terminated' }
    });
    if (existingEmployee) {
      return res.status(400).json({
        success: false,
        message: 'An active employee with this email already exists',
      });
    }

    // Check if there's a terminated employee with same email - reactivate instead
    const terminatedEmployee = await Employee.findOne({
      email: req.body.email.toLowerCase(),
      status: 'terminated'
    });
    if (terminatedEmployee) {
      // Update the terminated employee instead of creating new
      Object.assign(terminatedEmployee, req.body);
      terminatedEmployee.status = 'active';
      terminatedEmployee.dateOfLeaving = undefined;
      await terminatedEmployee.save();

      // Handle user account creation for reactivated employee
      if (req.body.createAccount) {
        const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
        if (existingUser) {
          // Reactivate existing user
          existingUser.isActive = true;
          existingUser.employeeId = terminatedEmployee._id;
          if (req.body.password) {
            existingUser.password = req.body.password;
          }
          await existingUser.save();
        } else {
          // Create new user
          await User.create({
            email: req.body.email,
            password: req.body.password || 'password123',
            role: req.body.role || 'employee',
            employeeId: terminatedEmployee._id,
            isActive: true,
          });
        }
      }

      return res.status(200).json({
        success: true,
        data: terminatedEmployee,
        message: 'Previously terminated employee has been reactivated',
      });
    }

    // Check if user account already exists with this email
    if (req.body.createAccount) {
      const existingUser = await User.findOne({ email: req.body.email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'A user account with this email already exists. Uncheck "Create user account" or use a different email.',
        });
      }
    }

    const employee = await Employee.create({
      ...req.body,
      employeeCode,
    });

    // Create user account if createAccount is true
    let userCreated = false;
    if (req.body.createAccount) {
      try {
        await User.create({
          email: req.body.email,
          password: req.body.password || 'password123',
          role: req.body.role || 'employee',
          employeeId: employee._id,
          isActive: true,
        });
        userCreated = true;
      } catch (userError) {
        console.error('User creation error:', userError);
        // Employee was created but user wasn't - report this
        return res.status(201).json({
          success: true,
          data: employee,
          warning: 'Employee created but user account could not be created: ' + userError.message,
        });
      }
    }

    res.status(201).json({
      success: true,
      data: employee,
      userCreated,
    });
  } catch (error) {
    console.error('Create employee error:', error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Employee with this email already exists',
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update employee
// @route   PATCH /api/v1/employees/:id
// @access  Private (Admin, HR)
exports.updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate('departmentId', 'name code')
      .populate('designationId', 'title');

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Delete employee
// @route   DELETE /api/v1/employees/:id
// @access  Private (Admin)
exports.deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
      });
    }

    // Soft delete - update status to terminated
    employee.status = 'terminated';
    employee.dateOfLeaving = new Date();
    await employee.save();

    // Deactivate user account
    await User.findOneAndUpdate(
      { employeeId: employee._id },
      { isActive: false }
    );

    res.status(200).json({
      success: true,
      message: 'Employee deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get employee stats
// @route   GET /api/v1/employees/stats
// @access  Private
exports.getEmployeeStats = async (req, res) => {
  try {
    const totalEmployees = await Employee.countDocuments({ status: { $ne: 'terminated' } });
    const activeEmployees = await Employee.countDocuments({ status: 'active' });
    const onLeave = await Employee.countDocuments({ status: 'on-leave' });

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
      { $unwind: '$department' },
      {
        $project: {
          name: '$department.name',
          count: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEmployees,
        activeEmployees,
        onLeave,
        departmentStats,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
