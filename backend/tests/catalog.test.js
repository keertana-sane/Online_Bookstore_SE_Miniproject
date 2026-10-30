const request = require('supertest');
const express = require('express');

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');

  const books = [
    {
      _id: 'book-1',
      title: 'Sample Book Alpha',
      author: 'Neha Menon',
      category: 'Romance',
      price: 250,
      stock_quantity: 10,
      is_active: true,
      createdAt: new Date('2026-01-02T00:00:00Z'),
    },
    {
      _id: 'book-2',
      title: 'Learning JavaScript',
      author: 'Arjun Reddy',
      category: 'Technology',
      price: 400,
      stock_quantity: 5,
      is_active: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
    },
    {
      _id: 'book-3',
      title: 'Hidden Book',
      author: 'Neha Menon',
      category: 'Romance',
      price: 100,
      stock_quantity: 2,
      is_active: false,
      createdAt: new Date('2025-12-01T00:00:00Z'),
    },
  ];

  const matches = (book, filter) => {
    if (filter.is_active !== undefined && book.is_active !== filter.is_active) {
      return false;
    }

    if (!filter.$or) return true;

    return filter.$or.some((condition) => {
      const [field, rule] = Object.entries(condition)[0];
      const regex = new RegExp(rule.$regex, rule.$options);
      return regex.test(book[field]);
    });
  };

  const Book = {
    find(filter) {
      let result = books.filter((book) => matches(book, filter));

      const query = {
        sort() {
          result.sort(
            (a, b) =>
              new Date(b.createdAt) - new Date(a.createdAt) ||
              String(b._id).localeCompare(String(a._id))
          );
          return query;
        },
        skip(count) {
          result = result.slice(count);
          return query;
        },
        limit(count) {
          result = result.slice(0, count);
          return query;
        },
        lean: async () => result,
      };

      return query;
    },

    countDocuments: jest.fn(async (filter) =>
      books.filter((book) => matches(book, filter)).length
    ),

    aggregate: jest.fn(() => ({
      then(resolve) {
        resolve([
          {
            totalStock: books
              .filter((book) => book.is_active)
              .reduce((total, book) => total + book.stock_quantity, 0),
          },
        ]);
      },
    })),
  };

  const connection = { readyState: 1 };

  const Schema = function Schema() {
    this.index = jest.fn();
  };
  Schema.Types = actual.Schema.Types;

  return {
    ...actual,
    Schema,
    model: jest.fn(() => Book),
    models: { Book },
    connection,
  };
});

const mongoose = require('mongoose');
const Book = mongoose.models.Book;

const app = express();

app.get('/api/books', async (req, res) => {
  try {
    const parsePositiveInteger = (value) => {
      if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
        return null;
      }

      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    const page =
      req.query.page === undefined ? 1 : parsePositiveInteger(req.query.page);

    const requestedLimit =
      req.query.limit === undefined ? 20 : parsePositiveInteger(req.query.limit);

    if (page === null || requestedLimit === null) {
      return res.status(400).json({
        message: 'Page and limit must be positive integers.',
      });
    }

    if (
      req.query.search !== undefined &&
      typeof req.query.search !== 'string'
    ) {
      return res.status(400).json({
        message: 'Search must be a single text value.',
      });
    }

    const search = (req.query.search || '').trim();

    if (search.length > 100) {
      return res.status(400).json({
        message: 'Search must be 100 characters or fewer.',
      });
    }

    const limit = Math.min(requestedLimit, 50);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: 'Requested page is too large.',
      });
    }

    const filter = { is_active: true };

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      filter.$or = [
        { title: { $regex: escapedSearch, $options: 'i' } },
        { author: { $regex: escapedSearch, $options: 'i' } },
        { category: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [books, totalBooks, stockResult] = await Promise.all([
      Book.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Book.countDocuments(filter),
      Book.aggregate([
        { $match: { is_active: true } },
        {
          $group: {
            _id: null,
            totalStock: { $sum: '$stock_quantity' },
          },
        },
      ]),
    ]);

    return res.json({
      search,
      books: books.map((book) => ({
        ...book,
        stock: book.stock_quantity,
        active: book.is_active,
      })),
      pagination: {
        page,
        limit,
        totalBooks,
        totalPages: Math.ceil(totalBooks / limit),
        totalStock: stockResult[0]?.totalStock ?? 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Internal server error.' });
  }
});

describe('TC-CAT: Catalog API', () => {
  test('TC-CAT-01: browse catalog with pagination metadata', async () => {
    const response = await request(app).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body.books).toHaveLength(2);
    expect(response.body.pagination.page).toBe(1);
    expect(response.body.pagination.limit).toBe(20);
    expect(response.body.pagination.totalBooks).toBe(2);
    expect(response.body.pagination.totalPages).toBe(1);
    expect(response.body.pagination.totalStock).toBe(15);
  });

  test('TC-CAT-02: search by title', async () => {
    const response = await request(app).get('/api/books?search=javascript');

    expect(response.status).toBe(200);
    expect(response.body.books).toHaveLength(1);
    expect(response.body.books[0].title).toBe('Learning JavaScript');
  });

  test('TC-CAT-03: search by author', async () => {
    const response = await request(app).get('/api/books?search=neha');

    expect(response.status).toBe(200);
    expect(response.body.books).toHaveLength(1);
    expect(response.body.books[0].author).toBe('Neha Menon');
  });

  test('TC-CAT-04: search by category', async () => {
    const response = await request(app).get('/api/books?search=technology');

    expect(response.status).toBe(200);
    expect(response.body.books).toHaveLength(1);
    expect(response.body.books[0].category).toBe('Technology');
  });

  test('TC-CAT-05: exclude inactive books', async () => {
    const response = await request(app).get('/api/books');

    expect(response.status).toBe(200);
    expect(response.body.books.some((book) => book.title === 'Hidden Book')).toBe(
      false
    );
  });

  test('TC-CAT-06: reject invalid page', async () => {
    const response = await request(app).get('/api/books?page=0');

    expect(response.status).toBe(400);
  });

  test('TC-CAT-07: reject invalid limit', async () => {
    const response = await request(app).get('/api/books?limit=-1');

    expect(response.status).toBe(400);
  });

  test('TC-CAT-08: cap page size at 50', async () => {
    const response = await request(app).get('/api/books?limit=100');

    expect(response.status).toBe(200);
    expect(response.body.pagination.limit).toBe(50);
  });

  test('TC-CAT-09: reject search longer than 100 characters', async () => {
    const search = 'a'.repeat(101);
    const response = await request(app).get(
      `/api/books?search=${search}`
    );

    expect(response.status).toBe(400);
  });

  test('TC-CAT-10: reject an excessively large page offset', async () => {
    const response = await request(app).get(
      '/api/books?page=9007199254740991&limit=50'
    );

    expect(response.status).toBe(400);
  });
});