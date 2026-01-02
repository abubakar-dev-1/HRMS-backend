const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const User = require('../src/models/User');
const authRoutes = require('../src/routes/auth');

// Create Express app for testing
const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', authRoutes);
  return app;
};

describe('Auth Controller', () => {
  let app;

  beforeAll(() => {
    // Set required environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRE = '15m';
    process.env.JWT_REFRESH_EXPIRE = '7d';
    app = createApp();
  });

  describe('POST /api/v1/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        email: 'test@test.com',
        password: 'password123',
        role: 'admin',
        isActive: true,
      });
    });

    it('should login successfully with valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('test@test.com');
    });

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'wrong@test.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Invalid credentials');
    });

    it('should fail with invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'wrongpassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail when email or password is missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail for inactive users', async () => {
      await User.updateOne({ email: 'test@test.com' }, { isActive: false });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'password123',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toBe('Your account has been deactivated');
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    beforeEach(async () => {
      await User.create({
        email: 'test@test.com',
        password: 'password123',
        role: 'employee',
        isActive: true,
      });
    });

    it('should verify email and return reset token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.resetToken).toBeDefined();
    });

    it('should fail for non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('should fail without email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    let resetToken;

    beforeEach(async () => {
      await User.create({
        email: 'test@test.com',
        password: 'password123',
        role: 'employee',
        isActive: true,
      });

      // Get reset token
      const res = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@test.com' });

      resetToken = res.body.resetToken;
    });

    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'test@test.com',
          resetToken,
          newPassword: 'newpassword123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify can login with new password
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'test@test.com',
          password: 'newpassword123',
        });

      expect(loginRes.status).toBe(200);
    });

    it('should fail with invalid token', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'test@test.com',
          resetToken: 'invalid-token',
          newPassword: 'newpassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with short password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({
          email: 'test@test.com',
          resetToken,
          newPassword: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('at least 6 characters');
    });
  });
});
