require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { mountAuthApi } = require("./authApi");
const { errorHandler } = require("./errorHandler");
const { requestLogger } = require("./requestLogger");
const { createCartCheckoutRouter } = require("../backend/routes/cartCheckoutModule");
const { createRequireRoleMiddleware } = require("../backend/middleware/requireRole");
const { sanitizeInput, sanitizeQuery } = require("../backend/middleware/sanitizeInput");
const { validateText, INPUT_LIMITS } = require("../backend/utils/validators");
const { isValidPrice } = require("../backend/utils/inputLimits");
const AppError = require("../backend/utils/AppError");

const app = express();
const PORT = process.env.PORT || 5000;

// Book model — field names match the seeded MongoDB collection.
const bookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    author: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
      max: 99999999.99,
      validate: {
        validator: isValidPrice,
        message: "price must have at most two decimal places",
      },
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
      max: 999999,
      validate: {
        validator: Number.isInteger,
        message: "stock_quantity must be a whole number",
      },
      default: 0,
    },
    description: {
      type: String,
      default: "",
    },
    cover_image: {
      type: String,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    seedBatch: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Book =
  mongoose.models.Book || mongoose.model("Book", bookSchema);

app.use(helmet());
app.use(requestLogger);
app.use(cors());
app.set("query parser", sanitizeQuery);
app.use(express.json({ limit: "32kb" }));
app.use(sanitizeInput);

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Online Bookstore API is running!",
  });
});
<<<<<<< HEAD
  // Health check (BK-32)
  const healthHandler = (req, res) => {
=======
  // Health check
  app.get("/api/health", (req, res, next) => {
>>>>>>> origin/main
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    return next(new AppError(503, "SERVICE_UNAVAILABLE", "Database is disconnected."));
  }

  res.json({
    status: "OK",
    application: "Online Bookstore",
    database: "Connected",
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// BK-10 + BK-11: Browse, paginate, and search books.
app.get("/api/books", async (req, res, next) => {
  try {
    const parsePositiveInteger = (value) => {
      if (
        typeof value !== "string" ||
        !/^[1-9]\d*$/.test(value)
      ) {
        return null;
      }

      const parsed = Number(value);
      return Number.isSafeInteger(parsed) ? parsed : null;
    };

    const page =
      req.query.page === undefined
        ? 1
        : parsePositiveInteger(req.query.page);

    const requestedLimit =
      req.query.limit === undefined
        ? 20
        : parsePositiveInteger(req.query.limit);

    if (page === null || requestedLimit === null) {
      throw new AppError(400, "BAD_REQUEST", "Page and limit must be positive integers.");
    }

    if (
      req.query.search !== undefined &&
      typeof req.query.search !== "string"
    ) {
      throw new AppError(400, "BAD_REQUEST", "Search must be a single text value.");
    }

    const search = (req.query.search || "").trim();

    if (search.length > 100) {
      throw new AppError(400, "BAD_REQUEST", "Search must be 100 characters or fewer.");
    }

    const limit = Math.min(requestedLimit, 50);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      throw new AppError(400, "BAD_REQUEST", "Requested page is too large.");
    }

    const filter = { is_active: true };

    // BK-11: Search title, author, or category.
    if (search) {
      const escapedSearch = search.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      filter.$or = [
        { title: { $regex: escapedSearch, $options: "i" } },
        { author: { $regex: escapedSearch, $options: "i" } },
        { category: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [books, totalBooks, stockResult] = await Promise.all([
      Book.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Book.countDocuments(filter),

      // Total stock across all active books, not just the current page.
      Book.aggregate([
        { $match: { is_active: true } },
        {
          $group: {
            _id: null,
            totalStock: { $sum: "$stock_quantity" },
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
    return next(error);
  }
});

// BK-12: Get one active book by MongoDB ID.
app.get("/api/books/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid book ID.");
    }

    const book = await Book.findOne({
      _id: id,
      is_active: true,
    }).lean();

    if (!book) {
      throw new AppError(404, "NOT_FOUND", "Book not found.");
    }

    return res.status(200).json({
      book: {
        ...book,
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Add a new book.
app.post("/api/books", async (req, res, next) => {
  try {
    const { title, author, price, category, stock } = req.body || {};
    const cleanTitle = validateText(title, "title", INPUT_LIMITS.title);
    const cleanAuthor = validateText(author, "author", INPUT_LIMITS.author);
    const cleanCategory = validateText(category, "category", INPUT_LIMITS.category);

    if (
      typeof price !== "number" ||
      !isValidPrice(price) ||
      price < 0.01 ||
      price > INPUT_LIMITS.price ||
      !Number.isInteger(stock) ||
      stock < 0 ||
      stock > INPUT_LIMITS.stock
    ) {
      throw new AppError(422, "VALIDATION_ERROR", "Book price or stock is outside the permitted range.");
    }

    const book = await Book.create({
      title: cleanTitle,
      author: cleanAuthor,
      price,
      category: cleanCategory,
      stock_quantity: stock,
      is_active: true,
    });

    return res.status(201).json({
      message: "Book added successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return next(new AppError(422, "VALIDATION_ERROR", "Book data failed validation."));
    }
    return next(error);
  }
});

// Edit book details.
app.put("/api/books/:id", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid book ID.");
    }

    const { title, author, price, category } = req.body || {};
    const cleanTitle = validateText(title, "title", INPUT_LIMITS.title);
    const cleanAuthor = validateText(author, "author", INPUT_LIMITS.author);
    const cleanCategory = validateText(category, "category", INPUT_LIMITS.category);

    if (
      typeof price !== "number" ||
      !isValidPrice(price) ||
      price < 0.01 ||
      price > INPUT_LIMITS.price
    ) {
      throw new AppError(422, "VALIDATION_ERROR", "Book price is outside the permitted range.");
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, is_active: true },
      {
        title: cleanTitle,
        author: cleanAuthor,
        price,
        category: cleanCategory,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      throw new AppError(404, "NOT_FOUND", "Book not found.");
    }

    return res.json({
      message: "Book updated successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Update stock.
app.patch("/api/books/:id/stock", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid book ID.");
    }

    const { stock } = req.body || {};

    if (!Number.isInteger(stock) || stock < 0 || stock > INPUT_LIMITS.stock) {
      throw new AppError(422, "VALIDATION_ERROR", "Stock must be a whole number from 0 to 999999.");
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, is_active: true },
      { stock_quantity: stock },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      throw new AppError(404, "NOT_FOUND", "Book not found.");
    }

    return res.json({
      message: "Stock updated successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Disable a book without deleting it.
app.patch("/api/books/:id/disable", async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      throw new AppError(400, "BAD_REQUEST", "Invalid book ID.");
    }

    const book = await Book.findByIdAndUpdate(
      req.params.id,
      { is_active: false },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      throw new AppError(404, "NOT_FOUND", "Book not found.");
    }

    return res.json({
      message: "Book disabled successfully.",
      book: {
        ...book.toObject(),
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    return next(error);
  }
});

// Connect to MongoDB and start the server.
async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI is missing. Configure it in server/.env."
      );
    }
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is missing from the server/.env file.");
    }

    await mongoose.connect(mongoUri);

    console.log("MongoDB connected successfully.");
    console.log("Database:", mongoose.connection.name);

    const { authenticate } = mountAuthApi({
      app,
      expressImpl: express,
      mongooseImpl: mongoose,
      jwtSecret: process.env.JWT_SECRET,
      bcryptImpl: bcrypt,
      jwtImpl: jwt
    });

    // Cart, checkout and orders (API-05 to API-12) are for logged-in CUSTOMERs only:
    // a valid token is checked first, then the role (staff accounts get 403).
    const requireCustomer = createRequireRoleMiddleware("CUSTOMER");
    const requireAdmin = createRequireRoleMiddleware("ADMIN_STAFF");
    const authenticateCustomer = (req, res, next) =>
      authenticate(req, res, (err) =>
        err ? next(err) : requireCustomer(req, res, next)
      );
    const authenticateAdmin = (req, res, next) =>
      authenticate(req, res, (err) =>
        err ? next(err) : requireAdmin(req, res, next)
      );
    app.use(
      "/api/v1",
      createCartCheckoutRouter({
        authenticate: authenticateCustomer,
        authenticateAdmin,
        mongooseImpl: mongoose,
      })
    );
    app.use((req, res, next) => {
      next(new AppError(404, "NOT_FOUND", "Resource not found."));
    });
    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log(
        `Online Bookstore API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();