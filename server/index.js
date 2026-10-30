require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { mountAuthApi } = require("./authApi");
const { errorHandler } = require("./errorHandler");
const { createCartCheckoutRouter } = require("../backend/routes/cartCheckoutModule");
const { createRequireRoleMiddleware } = require("../backend/middleware/requireRole");

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
    },
    stock_quantity: {
      type: Number,
      required: true,
      min: 0,
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

app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Online Bookstore API is running!",
  });
});

 // Health check (BK-32)
const healthHandler = (req, res) => {
  const connected = mongoose.connection.readyState === 1;

  res.status(connected ? 200 : 503).json({
    status: connected ? "OK" : "Disconnected",
    application: "Online Bookstore",
    database: connected ? "Connected" : "Disconnected",
  });
};

app.get("/health", healthHandler);
app.get("/api/health", healthHandler);

// BK-10 + BK-11: Browse, paginate, and search books.
app.get("/api/books", async (req, res) => {
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
      return res.status(400).json({
        message: "Page and limit must be positive integers.",
      });
    }

    if (
      req.query.search !== undefined &&
      typeof req.query.search !== "string"
    ) {
      return res.status(400).json({
        message: "Search must be a single text value.",
      });
    }

    const search = (req.query.search || "").trim();

    if (search.length > 100) {
      return res.status(400).json({
        message: "Search must be 100 characters or fewer.",
      });
    }

    const limit = Math.min(requestedLimit, 50);
    const skip = (page - 1) * limit;

    if (!Number.isSafeInteger(skip)) {
      return res.status(400).json({
        message: "Requested page is too large.",
      });
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
    console.error("Error fetching books:", error);

    return res.status(500).json({
      message: "Failed to fetch books.",
    });
  }
});

// BK-12: Get one active book by MongoDB ID.
app.get("/api/books/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    const book = await Book.findOne({
      _id: id,
      is_active: true,
    }).lean();

    if (!book) {
      return res.status(404).json({
        message: "Book not found.",
      });
    }

    return res.status(200).json({
      book: {
        ...book,
        stock: book.stock_quantity,
        active: book.is_active,
      },
    });
  } catch (error) {
    console.error("Error fetching book details:", error);

    return res.status(500).json({
      message: "Failed to fetch book details.",
    });
  }
});

// Add a new book.
app.post("/api/books", async (req, res) => {
  try {
    const { title, author, price, category, stock } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0.01 ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      return res.status(400).json({
        message:
          "Enter a valid title, author, category, price of at least 0.01, and non-negative whole-number stock.",
      });
    }

    const book = await Book.create({
      title: title.trim(),
      author: author.trim(),
      price,
      category: category.trim(),
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
    console.error("Error adding book:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({
        message: "Book data failed validation.",
      });
    }

    return res.status(500).json({
      message: "Failed to add book.",
    });
  }
});

// Edit book details.
app.put("/api/books/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    const { title, author, price, category } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof author !== "string" ||
      !author.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      typeof price !== "number" ||
      !Number.isFinite(price) ||
      price < 0.01
    ) {
      return res.status(400).json({
        message:
          "Enter a valid title, author, category, and price of at least 0.01.",
      });
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, is_active: true },
      {
        title: title.trim(),
        author: author.trim(),
        price,
        category: category.trim(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!book) {
      return res.status(404).json({
        message: "Book not found.",
      });
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
    console.error("Error updating book:", error);

    return res.status(500).json({
      message: "Failed to update book.",
    });
  }
});

// Update stock.
app.patch("/api/books/:id/stock", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
    }

    const { stock } = req.body;

    if (!Number.isInteger(stock) || stock < 0) {
      return res.status(400).json({
        message: "Stock must be a non-negative whole number.",
      });
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
      return res.status(404).json({
        message: "Book not found.",
      });
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
    console.error("Error updating stock:", error);

    return res.status(500).json({
      message: "Failed to update stock.",
    });
  }
});

// Disable a book without deleting it.
app.patch("/api/books/:id/disable", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid book ID.",
      });
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
      return res.status(404).json({
        message: "Book not found.",
      });
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
    console.error("Error disabling book:", error);

    return res.status(500).json({
      message: "Failed to disable book.",
    });
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
    const authenticateCustomer = (req, res, next) =>
      authenticate(req, res, (err) =>
        err ? next(err) : requireCustomer(req, res, next)
      );
    app.use(
      "/api/v1",
      createCartCheckoutRouter({
        authenticate: authenticateCustomer,
        mongooseImpl: mongoose,
      })
    );
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