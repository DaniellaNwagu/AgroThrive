const WaitlistEntry = require('../models/WaitlistEntry');

describe('WaitlistEntry', () => {
  describe('constructor', () => {
    it('should initialize all fields to null when no data provided', () => {
      const entry = new WaitlistEntry();

      expect(entry.id).toBeNull();
      expect(entry.buyer_id).toBeNull();
      expect(entry.product_id).toBeNull();
      expect(entry.quantity).toBeNull();
      expect(entry.position).toBeNull();
      expect(entry.created_at).toBeNull();
      expect(entry.buyer_name).toBeNull();
      expect(entry.buyer_email).toBeNull();
      expect(entry.product_name).toBeNull();
      expect(entry.product_price).toBeNull();
    });

    it('should assign provided data', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
      });

      expect(entry.id).toBe(1);
      expect(entry.buyer_id).toBe(2);
      expect(entry.product_id).toBe(3);
      expect(entry.quantity).toBe(4);
      expect(entry.position).toBe(5);
      expect(entry.created_at).toBe('2024-01-01T00:00:00.000Z');
    });
  });

  describe('validate', () => {
    it('should be valid with all required fields', () => {
      const entry = new WaitlistEntry({
        buyer_id: 1,
        product_id: 2,
        quantity: 3,
      });

      const result = entry.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should be invalid when required fields are missing', () => {
      const entry = new WaitlistEntry();

      const result = entry.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('buyer_id must be a positive integer');
      expect(result.errors).toContain('product_id must be a positive integer');
      expect(result.errors).toContain('quantity must be a positive integer');
    });

    it('should reject non-positive integers', () => {
      const entry = new WaitlistEntry({
        buyer_id: 0,
        product_id: -1,
        quantity: 1.5,
      });

      const result = entry.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('buyer_id must be a positive integer');
      expect(result.errors).toContain('product_id must be a positive integer');
      expect(result.errors).toContain('quantity must be a positive integer');
    });

    it('should validate position when provided', () => {
      const entry = new WaitlistEntry({
        buyer_id: 1,
        product_id: 2,
        quantity: 3,
        position: -5,
      });

      const result = entry.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('position must be a positive integer');
    });

    it('should validate created_at when provided', () => {
      const entry = new WaitlistEntry({
        buyer_id: 1,
        product_id: 2,
        quantity: 3,
        created_at: 'not-a-date',
      });

      const result = entry.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('created_at must be a valid date');
    });
  });

  describe('toJSON / format', () => {
    it('should return exactly the six core keys for a bare entry', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
      });

      const json = entry.toJSON();

      expect(Object.keys(json)).toEqual([
        'id',
        'buyer_id',
        'product_id',
        'quantity',
        'position',
        'created_at',
      ]);
    });

    it('should omit the four optional keys for a bare entry', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
      });

      const json = entry.toJSON();

      expect(json).not.toHaveProperty('buyer_name');
      expect(json).not.toHaveProperty('buyer_email');
      expect(json).not.toHaveProperty('product_name');
      expect(json).not.toHaveProperty('product_price');
    });

    it('should include the four optional keys with correct values when populated', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
        buyer_name: 'Jane Doe',
        buyer_email: 'jane@example.com',
        product_name: 'Widget',
        product_price: 19.99,
      });

      const json = entry.toJSON();

      expect(json.buyer_name).toBe('Jane Doe');
      expect(json.buyer_email).toBe('jane@example.com');
      expect(json.product_name).toBe('Widget');
      expect(json.product_price).toBe(19.99);
    });

    it('should include only the populated optional keys', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
        buyer_name: 'Jane Doe',
      });

      const json = entry.toJSON();

      expect(json).toHaveProperty('buyer_name', 'Jane Doe');
      expect(json).not.toHaveProperty('buyer_email');
      expect(json).not.toHaveProperty('product_name');
      expect(json).not.toHaveProperty('product_price');
    });

    it('should have format() deep-equal toJSON()', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
        buyer_name: 'Jane Doe',
        buyer_email: 'jane@example.com',
        product_name: 'Widget',
        product_price: 19.99,
      });

      expect(entry.format()).toEqual(entry.toJSON());
    });
  });

  describe('fromJSON', () => {
    it('should parse a JSON string', () => {
      const entry = WaitlistEntry.fromJSON('{"id":1,"buyer_id":2}');

      expect(entry).toBeInstanceOf(WaitlistEntry);
      expect(entry.id).toBe(1);
      expect(entry.buyer_id).toBe(2);
    });

    it('should accept a plain object', () => {
      const entry = WaitlistEntry.fromJSON({ id: 1, buyer_id: 2 });

      expect(entry).toBeInstanceOf(WaitlistEntry);
      expect(entry.id).toBe(1);
    });

    it('should throw on invalid JSON string', () => {
      expect(() => WaitlistEntry.fromJSON('{invalid')).toThrow(/Invalid JSON string/);
    });

    it('should throw on non-object input', () => {
      expect(() => WaitlistEntry.fromJSON(42)).toThrow(
        'Input must be a JSON string or object'
      );
    });
  });

  describe('fromDatabaseRow', () => {
    it('should return null for falsy row', () => {
      expect(WaitlistEntry.fromDatabaseRow(null)).toBeNull();
    });

    it('should map row fields including joined fields', () => {
      const entry = WaitlistEntry.fromDatabaseRow({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        position: 5,
        created_at: '2024-01-01T00:00:00.000Z',
        buyer_name: 'Jane Doe',
        buyer_email: 'jane@example.com',
        product_name: 'Widget',
        product_price: 19.99,
      });

      expect(entry).toBeInstanceOf(WaitlistEntry);
      expect(entry.buyer_name).toBe('Jane Doe');
      expect(entry.product_price).toBe(19.99);
    });
  });

  describe('validateCreateInput', () => {
    it('should return valid data for correct input', () => {
      const result = WaitlistEntry.validateCreateInput({
        buyer_id: 1,
        product_id: 2,
        quantity: 3,
      });

      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ buyer_id: 1, product_id: 2, quantity: 3 });
    });

    it('should collect errors for invalid input', () => {
      const result = WaitlistEntry.validateCreateInput({});

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
    });
  });

  describe('equals', () => {
    it('should return true for equal entries', () => {
      const a = new WaitlistEntry({ id: 1, buyer_id: 2, product_id: 3, quantity: 4 });
      const b = new WaitlistEntry({ id: 1, buyer_id: 2, product_id: 3, quantity: 4 });

      expect(a.equals(b)).toBe(true);
    });

    it('should return false for different entries', () => {
      const a = new WaitlistEntry({ id: 1, buyer_id: 2, product_id: 3, quantity: 4 });
      const b = new WaitlistEntry({ id: 9, buyer_id: 2, product_id: 3, quantity: 4 });

      expect(a.equals(b)).toBe(false);
    });

    it('should return false for non-WaitlistEntry input', () => {
      const a = new WaitlistEntry({ id: 1 });

      expect(a.equals({ id: 1 })).toBe(false);
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const entry = new WaitlistEntry({
        id: 1,
        buyer_id: 2,
        product_id: 3,
        quantity: 4,
        buyer_name: 'Jane Doe',
      });

      const copy = entry.clone();

      expect(copy).toBeInstanceOf(WaitlistEntry);
      expect(copy.equals(entry)).toBe(true);
      expect(copy.buyer_name).toBe('Jane Doe');
      expect(copy).not.toBe(entry);
    });
  });
});
