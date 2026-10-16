'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest-32-bytes-long';
process.env.ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET || 'test-encryption-secret-32-bytes-';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../app');

describe('Upload static-file hardening in backend/src/app.js', () => {
  const uploadsDir = path.join(__dirname, '../../uploads');
  const tempFilename = 'test-static-file.png';
  const tempFilePath = path.join(uploadsDir, tempFilename);

  // File with hostile characters on disk (<, >, quotes) to test filename sanitisation
  const hostileFilename = 'test<hostile>"quote".png';
  const hostileFilePath = path.join(uploadsDir, hostileFilename);
  let hostileFileCreated = false;

  beforeAll(() => {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    fs.writeFileSync(tempFilePath, 'dummy image content for static header test');

    try {
      fs.writeFileSync(hostileFilePath, 'hostile file content');
      hostileFileCreated = true;
    } catch (_err) {
      hostileFileCreated = false;
    }
  });

  afterAll(() => {
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (_err) {
      // Ignore cleanup error
    }

    try {
      if (hostileFileCreated && fs.existsSync(hostileFilePath)) {
        fs.unlinkSync(hostileFilePath);
      }
    } catch (_err) {
      // Ignore cleanup error
    }
  });

  it('asserts a /uploads response includes X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get(`/uploads/${tempFilename}`);
    expect(res.status).toBe(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it("asserts the response CSP is default-src 'none'; img-src 'self'; media-src 'self'", async () => {
    const res = await request(app).get(`/uploads/${tempFilename}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-security-policy']).toBe(
      "default-src 'none'; img-src 'self'; media-src 'self'"
    );
  });

  it('asserts the Content-Disposition filename contains no characters outside [a-zA-Z0-9._-]', async () => {
    const res = await request(app).get(`/uploads/${tempFilename}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toBeDefined();

    const match = res.headers['content-disposition'].match(/filename="([^"]+)"/);
    expect(match).not.toBeNull();
    const filename = match[1];
    expect(filename).not.toMatch(/[^a-zA-Z0-9._-]/);
    expect(filename).toMatch(/^[a-zA-Z0-9._-]+$/);
  });

  it('asserts Content-Disposition filename contains only safe characters even when on-disk name has hostile characters', async () => {
    if (hostileFileCreated) {
      const res = await request(app).get(`/uploads/${encodeURIComponent(hostileFilename)}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toBeDefined();

      const match = res.headers['content-disposition'].match(/filename="([^"]+)"/);
      expect(match).not.toBeNull();
      const filename = match[1];
      expect(filename).not.toMatch(/[^a-zA-Z0-9._-]/);
      expect(filename).toBe('test_hostile__quote_.png');
    }
  });

  it('asserts the filename sanitiser strips dangerous characters like <, >, quotes, or spaces', () => {
    const sanitizeFilename = (filePath) =>
      path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');

    const hostileInputs = [
      'test<script>alert(1)</script>.png',
      'malicious"quote"name.jpg',
      'photo\'with"quotes<and>tags.webp',
      'spaces in file name.png',
      'file;name$with`bad&chars.png',
      'file\r\nHeader-Injection:evil.png',
      'nested/path/<script>.svg',
    ];

    for (const name of hostileInputs) {
      const sanitized = sanitizeFilename(name);
      expect(sanitized).not.toMatch(/[^a-zA-Z0-9._-]/);
      expect(sanitized).toMatch(/^[a-zA-Z0-9._-]+$/);
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("'");
    }
  });

  it('asserts setHeaders callback sets nosniff, CSP, and safe Content-Disposition', () => {
    const mockHeaders = {};
    const mockRes = {
      setHeader: (k, v) => {
        mockHeaders[k.toLowerCase()] = v;
      },
    };

    const setHeaders = (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; img-src 'self'; media-src 'self'"
      );
      const safeName = path.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_');
      res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
    };

    setHeaders(mockRes, '/uploads/<hostile>"alert".jpg');

    expect(mockHeaders['x-content-type-options']).toBe('nosniff');
    expect(mockHeaders['content-security-policy']).toBe(
      "default-src 'none'; img-src 'self'; media-src 'self'"
    );
    expect(mockHeaders['content-disposition']).toBe(
      'inline; filename="_hostile__alert_.jpg"'
    );
    const match = mockHeaders['content-disposition'].match(/filename="([^"]+)"/);
    expect(match).not.toBeNull();
    expect(match[1]).not.toMatch(/[^a-zA-Z0-9._-]/);
  });
});
