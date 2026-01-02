const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const User = require('../src/models/User');
const Employee = require('../src/models/Employee');
const Department = require('../src/models/Department');
const employeeRoutes = require('../src/routes/employees');
const { protect, authorize } = require('../src/middleware/auth');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/employees', employeeRoutes);
  return app;
};

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
};

describe('Employee Controller', () => {
  let app;
  let adminUser;
  let adminToken;
  let department;

  beforeAll(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    app = createApp();
  });

  beforeEach(async () => {
    // Create department
    department = await Department.create({
      name: 'Engineering',
      code: 'ENG',
      description: 'Engineering Department',
    });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role: 'admin',
      isActive: true,
    });

    adminToken = generateToken(adminUser._id);
  });

  describe('GET /api/v1/employees', () => {
    beforeEach(async () => {
      await Employee.create([
        {
          employeeCode: 'EMP-0001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@test.com',
          dateOfJoining: new Date(),
          departmentId: department._id,
        },
        {
          employeeCode: 'EMP-0002',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane@test.com',
          dateOfJoining: new Date(),
          departmentId: department._id,
        },
      ]);
    });

    it('should get all employees', async () => {
      const res = await request(app)
        .get('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.pagination).toBeDefined();
    });

    it('should paginate employees', async () => {
      const res = await request(app)
        .get('/api/v1/employees?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.totalPages).toBe(2);
    });

    it('should search employees', async () => {
      const res = await request(app)
        .get('/api/v1/employees?search=john')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].firstName).toBe('John');
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/v1/employees');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/employees/:id', () => {
    let employee;

    beforeEach(async () => {
      employee = await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
        departmentId: department._id,
      });
    });

    it('should get single employee', async () => {
      const res = await request(app)
        .get(`/api/v1/employees/${employee._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('John');
    });

    it('should return 404 for non-existent employee', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const res = await request(app)
        .get(`/api/v1/employees/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/employees', () => {
    it('should create new employee', async () => {
      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'New',
          lastName: 'Employee',
          email: 'new@test.com',
          dateOfJoining: new Date(),
          departmentId: department._id,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('New');
      expect(res.body.data.employeeCode).toBeDefined();
    });

    it('should fail with duplicate email', async () => {
      await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/employees')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Another',
          lastName: 'John',
          email: 'john@test.com',
          dateOfJoining: new Date(),
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already exists');
    });
  });

  describe('PATCH /api/v1/employees/:id', () => {
    let employee;

    beforeEach(async () => {
      employee = await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
      });
    });

    it('should update employee', async () => {
      const res = await request(app)
        .patch(`/api/v1/employees/${employee._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'Updated',
          phone: '1234567890',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('Updated');
      expect(res.body.data.phone).toBe('1234567890');
    });
  });

  describe('DELETE /api/v1/employees/:id', () => {
    let employee;

    beforeEach(async () => {
      employee = await Employee.create({
        employeeCode: 'EMP-0001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        dateOfJoining: new Date(),
        status: 'active',
      });
    });

    it('should soft delete employee (terminate)', async () => {
      const res = await request(app)
        .delete(`/api/v1/employees/${employee._id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedEmployee = await Employee.findById(employee._id);
      expect(deletedEmployee.status).toBe('terminated');
    });
  });
});
