# Catalog Module Documentation

**Project:** Team 15 — Online Bookstore  
**Ticket:** BK-34

## 1. Overview

The catalog module allows customers to browse available books and search for books by keyword. It provides paginated results and displays book information needed to select a book for purchase.

## 2. Catalog Functionality

- Browse books in the catalog.
- Search for books using a keyword.
- Navigate through paginated results.
- Display book information.
- Restrict purchasing to active books with available stock.

## 3. API Endpoints

The catalog API uses the `/api/books` route.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/books` | Retrieve catalog books |
| GET | `/api/books?page=1&limit=20` | Retrieve a paginated list |
| GET | `/api/books?search=sample&page=1&limit=20` | Search books with pagination |

The examples above reflect the endpoints used in the catalog performance test. Other response fields and validation rules should be confirmed against the implementation.

## 4. Performance Optimization

The Book model includes a compound index on:

`{ is_active: 1, createdAt: -1, _id: -1 }`

This index is intended to support active-book filtering and newest-first pagination.

Performance test configuration and recorded results are documented in `catalog_performance.md`, `catalog_performance_test.jmx`, and `catalog_performance_results.csv`.

## 5. Testing

Catalog-related verification includes:

- Browsing the catalog.
- Searching for books.
- Checking pagination parameters.
- Checking invalid page and limit values.
- Checking excessively long search input.
- Reviewing performance-test results.

The Postman collection is located at `postman/catalog_collection.json`.

## 6. Deviations and Limitations

1. **Book field naming:** The Book model uses fields such as `stock_quantity` and `is_active`, whereas the SAD describes `stockQuantity` and `isActive`. The mapping is documented in `CART_CHECKOUT.md`.
2. **Price representation:** The implementation uses a JavaScript `Number` for the Book price, whereas the SAD specifies Decimal128. Money calculations are documented as using integer cents.
3. **Search performance:** The compound index is intended to support active-book filtering and sorting. It is not assumed to accelerate every keyword search; actual benefits depend on the query and database execution plan.
4. **Performance evidence:** Recorded results describe the tested environment and workload. They should not be interpreted as production performance guarantees.
5. **Additional verification:** API behavior and validation rules should be checked against the running implementation before being treated as fully verified.

## 7. Related Documentation

- `CART_CHECKOUT.md`
- `catalog_performance.md`
- `catalog_performance_test.jmx`
- `catalog_performance_results.csv`
- `../postman/catalog_collection.json`