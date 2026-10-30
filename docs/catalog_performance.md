# Catalog Performance Testing (BK-29)

## 1. Objective
Evaluate the response time and reliability of the bookstore catalog browsing and search endpoints under concurrent requests.

## 2. Database Index
The Book Mongoose schema includes the following compound index:

`{ is_active: 1, createdAt: -1, _id: -1 }`

This index targets filtering active books and sorting by creation date and ID for catalog pagination.

The catalog search currently uses case-insensitive regular expressions across title, author, and category. The compound index does not guarantee faster substring searches.

## 3. Test Tool and Endpoints
Tool: Apache JMeter 5.6.3

- Browse Catalog: `GET /api/books?page=1&limit=20`
- Search Catalog: `GET /api/books?search=sample&page=1&limit=20`

Base URL: `http://localhost:5000`

## 4. Observed Results

| Metric | Browse Catalog | Search Catalog |
|---|---:|---:|
| Requests | 500 | 500 |
| Average response time | 4 ms | 6 ms |
| Minimum response time | 3 ms | 5 ms |
| Maximum response time | 22 ms | 18 ms |
| Error rate | 0% | 0% |
| Throughput | 50.5 requests/sec | 50.5 requests/sec |

Total successful requests: 1,000.

## 5. Test Configuration
The JMeter test plan is stored in `catalog_performance_test.jmx`.

Before documenting the run as a verified 50-concurrent-user test, confirm the Thread Group's thread count, ramp-up period, and loop count.

## 6. Limitations
- Results reflect the local development environment.
- Results represent an observed run, not a performance guarantee.
- No before-and-after benchmark has been recorded to establish the index's performance impact.
- Search uses regular-expression matching, which may not benefit from the compound pagination index.

## 7. Reproduction
1. Start the bookstore server and ensure MongoDB is available.
2. Open `catalog_performance_test.jmx` in Apache JMeter.
3. Verify the Thread Group settings.
4. Run the test.
5. Review the Summary Report and save the results CSV.