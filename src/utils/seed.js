require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Employee = require('../models/Employee');
const Department = require('../models/Department');
const Designation = require('../models/Designation');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

const seedData = async () => {
  try {
    await connectDB();

    // Clear existing data
    await User.deleteMany({});
    await Employee.deleteMany({});
    await Department.deleteMany({});
    await Designation.deleteMany({});

    console.log('Cleared existing data');

    // Create departments
    const departments = await Department.create([
      { name: 'Engineering', code: 'ENG', description: 'Software Engineering Department' },
      { name: 'Human Resources', code: 'HR', description: 'HR Department' },
      { name: 'Marketing', code: 'MKT', description: 'Marketing Department' },
      { name: 'Sales', code: 'SALES', description: 'Sales Department' },
      { name: 'Finance', code: 'FIN', description: 'Finance Department' },
    ]);

    console.log('Created departments');

    // Create designations
    const designations = await Designation.create([
      { title: 'CEO', code: 'CEO', description: 'Chief Executive Officer', level: 10 },
      { title: 'CTO', code: 'CTO', description: 'Chief Technology Officer', level: 9, departmentId: departments[0]._id },
      { title: 'HR Director', code: 'HRD', description: 'Human Resources Director', level: 8, departmentId: departments[1]._id },
      { title: 'Engineering Manager', code: 'EM', description: 'Engineering Team Manager', level: 7, departmentId: departments[0]._id },
      { title: 'Senior Software Engineer', code: 'SSE', description: 'Senior level software developer', level: 5, departmentId: departments[0]._id },
      { title: 'Software Engineer', code: 'SWE', description: 'Software developer', level: 4, departmentId: departments[0]._id },
      { title: 'Junior Software Engineer', code: 'JSE', description: 'Entry level developer', level: 3, departmentId: departments[0]._id },
      { title: 'HR Manager', code: 'HRM', description: 'HR Team Manager', level: 6, departmentId: departments[1]._id },
      { title: 'HR Specialist', code: 'HRS', description: 'HR team member', level: 4, departmentId: departments[1]._id },
      { title: 'Marketing Manager', code: 'MM', description: 'Marketing Team Manager', level: 6, departmentId: departments[2]._id },
      { title: 'Sales Manager', code: 'SM', description: 'Sales Team Manager', level: 6, departmentId: departments[3]._id },
      { title: 'Accountant', code: 'ACC', description: 'Finance team member', level: 4, departmentId: departments[4]._id },
    ]);

    console.log('Created designations');

    // Create employees
    const employees = await Employee.create([
      {
        employeeCode: 'EMP-0001',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@hrms.com',
        phone: '+1234567890',
        dateOfBirth: new Date('1985-01-15'),
        gender: 'male',
        departmentId: departments[1]._id, // HR
        employmentType: 'full-time',
        dateOfJoining: new Date('2020-01-01'),
        status: 'active',
      },
      {
        employeeCode: 'EMP-0002',
        firstName: 'HR',
        lastName: 'Manager',
        email: 'hr@hrms.com',
        phone: '+1234567891',
        dateOfBirth: new Date('1988-05-20'),
        gender: 'female',
        departmentId: departments[1]._id, // HR
        employmentType: 'full-time',
        dateOfJoining: new Date('2021-03-15'),
        status: 'active',
      },
      {
        employeeCode: 'EMP-0003',
        firstName: 'John',
        lastName: 'Employee',
        email: 'employee@hrms.com',
        phone: '+1234567892',
        dateOfBirth: new Date('1992-08-10'),
        gender: 'male',
        departmentId: departments[0]._id, // Engineering
        employmentType: 'full-time',
        dateOfJoining: new Date('2022-06-01'),
        status: 'active',
      },
      {
        employeeCode: 'EMP-0004',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@hrms.com',
        phone: '+1234567893',
        dateOfBirth: new Date('1990-03-25'),
        gender: 'female',
        departmentId: departments[2]._id, // Marketing
        employmentType: 'full-time',
        dateOfJoining: new Date('2021-09-01'),
        status: 'active',
      },
      {
        employeeCode: 'EMP-0005',
        firstName: 'Mike',
        lastName: 'Johnson',
        email: 'mike.johnson@hrms.com',
        phone: '+1234567894',
        dateOfBirth: new Date('1987-11-08'),
        gender: 'male',
        departmentId: departments[3]._id, // Sales
        employmentType: 'full-time',
        dateOfJoining: new Date('2020-08-15'),
        status: 'active',
      },
    ]);

    console.log('Created employees');

    // Create users
    await User.create([
      {
        email: 'admin@hrms.com',
        password: 'admin123',
        role: 'admin',
        employeeId: employees[0]._id,
        isActive: true,
      },
      {
        email: 'hr@hrms.com',
        password: 'hr12345',
        role: 'hr',
        employeeId: employees[1]._id,
        isActive: true,
      },
      {
        email: 'employee@hrms.com',
        password: 'emp12345',
        role: 'employee',
        employeeId: employees[2]._id,
        isActive: true,
      },
    ]);

    console.log('Created users');

    console.log('');
    console.log('=================================');
    console.log('Database seeded successfully!');
    console.log('=================================');
    console.log('');
    console.log('Demo Credentials:');
    console.log('---------------------------------');
    console.log('Admin: admin@hrms.com / admin123');
    console.log('HR: hr@hrms.com / hr12345');
    console.log('Employee: employee@hrms.com / emp12345');
    console.log('---------------------------------');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedData();
