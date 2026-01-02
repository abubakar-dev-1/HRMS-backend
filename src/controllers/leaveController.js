const Leave = require('../models/Leave');
const Employee = require('../models/Employee');

// @desc    Get all leaves
// @route   GET /api/v1/leaves
// @access  Private
exports.getLeaves = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, employeeId } = req.query;
    const query = {};

    // If not admin/hr, only show own leaves
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ email: req.user.email });
      if (employee) {
        query.employeeId = employee._id;
      }
    } else if (employeeId) {
      query.employeeId = employeeId;
    }

    if (status) {
      query.status = status;
    }

    if (type) {
      query.leaveType = type;
    }

    const leaves = await Leave.find(query)
      .populate('employeeId', 'firstName lastName email employeeCode')
      .populate('approvedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Leave.countDocuments(query);

    res.status(200).json({
      success: true,
      data: leaves,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get leaves error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get single leave
// @route   GET /api/v1/leaves/:id
// @access  Private
exports.getLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id)
      .populate('employeeId', 'firstName lastName email employeeCode departmentId')
      .populate('approvedBy', 'firstName lastName');

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Create leave request
// @route   POST /api/v1/leaves
// @access  Private
exports.createLeave = async (req, res) => {
  try {
    // Get employee from logged in user
    let employeeId = req.body.employeeId;

    if (!employeeId && req.user.employeeId) {
      // Handle populated object
      employeeId = req.user.employeeId._id || req.user.employeeId;
    }

    if (!employeeId) {
      // Try to find by email
      const employee = await Employee.findOne({ email: req.user.email });
      employeeId = employee?._id;
    }

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile linked to your account. Please contact HR.',
      });
    }

    const leave = await Leave.create({
      ...req.body,
      employeeId,
    });

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'firstName lastName email employeeCode');

    res.status(201).json({
      success: true,
      data: populatedLeave,
    });
  } catch (error) {
    console.error('Create leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Update leave request
// @route   PATCH /api/v1/leaves/:id
// @access  Private
exports.updateLeave = async (req, res) => {
  try {
    let leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    // Only allow updates if status is pending
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update leave request that has been processed',
      });
    }

    leave = await Leave.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('employeeId', 'firstName lastName email employeeCode');

    res.status(200).json({
      success: true,
      data: leave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Approve leave request
// @route   PATCH /api/v1/leaves/:id/approve
// @access  Private (Admin, HR)
exports.approveLeave = async (req, res) => {
  try {
    let leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request has already been processed',
      });
    }

    // Get approver's employee ID
    const approver = await Employee.findOne({ email: req.user.email });

    // Prevent self-approval
    if (approver && leave.employeeId.toString() === approver._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot approve your own leave request',
      });
    }

    leave.status = 'approved';
    leave.approvedBy = approver?._id;
    leave.approvedAt = new Date();
    leave.approverComments = req.body.comments;
    await leave.save();

    // Deduct leave balance from employee
    const employee = await Employee.findById(leave.employeeId);
    if (employee && employee.leaveBalance) {
      const leaveTypeKey = leave.leaveType.toLowerCase().replace('-', '');
      if (employee.leaveBalance[leaveTypeKey] !== undefined) {
        employee.leaveBalance[leaveTypeKey] -= leave.totalDays;
        await employee.save();
      }
    }

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'firstName lastName email employeeCode')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: populatedLeave,
    });
  } catch (error) {
    console.error('Approve leave error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Reject leave request
// @route   PATCH /api/v1/leaves/:id/reject
// @access  Private (Admin, HR)
exports.rejectLeave = async (req, res) => {
  try {
    let leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Leave request has already been processed',
      });
    }

    const approver = await Employee.findOne({ email: req.user.email });

    // Prevent self-rejection
    if (approver && leave.employeeId.toString() === approver._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot reject your own leave request',
      });
    }

    leave.status = 'rejected';
    leave.approvedBy = approver?._id;
    leave.approvedAt = new Date();
    leave.approverComments = req.body.comments || req.body.reason;
    await leave.save();

    const populatedLeave = await Leave.findById(leave._id)
      .populate('employeeId', 'firstName lastName email employeeCode')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({
      success: true,
      data: populatedLeave,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Delete leave request
// @route   DELETE /api/v1/leaves/:id
// @access  Private
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id);

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: 'Leave request not found',
      });
    }

    // Only allow deletion if status is pending
    if (leave.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete leave request that has been processed',
      });
    }

    await leave.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Leave request deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// @desc    Get leave stats
// @route   GET /api/v1/leaves/stats
// @access  Private
exports.getLeaveStats = async (req, res) => {
  try {
    const pending = await Leave.countDocuments({ status: 'pending' });
    const approved = await Leave.countDocuments({ status: 'approved' });
    const rejected = await Leave.countDocuments({ status: 'rejected' });

    const byType = await Leave.aggregate([
      { $group: { _id: '$leaveType', count: { $sum: 1 } } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
        byType,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
