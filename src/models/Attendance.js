const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    clockIn: {
      type: Date,
    },
    clockOut: {
      type: Date,
    },
    breakStart: {
      type: Date,
    },
    breakEnd: {
      type: Date,
    },
    totalWorkHours: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'half-day', 'on-leave', 'holiday', 'weekend'],
      default: 'present',
    },
    location: {
      clockInLocation: {
        latitude: Number,
        longitude: Number,
        address: String,
      },
      clockOutLocation: {
        latitude: Number,
        longitude: Number,
        address: String,
      },
    },
    notes: {
      type: String,
      trim: true,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    isEarlyLeave: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate work hours before saving
attendanceSchema.pre('save', function (next) {
  if (this.clockIn && this.clockOut) {
    let workMs = this.clockOut - this.clockIn;

    // Subtract break time if available
    if (this.breakStart && this.breakEnd) {
      workMs -= (this.breakEnd - this.breakStart);
    }

    this.totalWorkHours = Math.round((workMs / (1000 * 60 * 60)) * 100) / 100;
  }
  next();
});

// Unique compound index for employee and date
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
