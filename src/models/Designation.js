const mongoose = require('mongoose');

const designationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Designation title is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: [true, 'Designation code is required'],
      uppercase: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for employee count
designationSchema.virtual('employeeCount', {
  ref: 'Employee',
  localField: '_id',
  foreignField: 'designationId',
  count: true,
});

// Index for frequently queried fields
designationSchema.index({ title: 1 });
designationSchema.index({ departmentId: 1 });
designationSchema.index({ isActive: 1 });

module.exports = mongoose.model('Designation', designationSchema);
