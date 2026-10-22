# Multiple purchase invoices per sale

A second distinct incoming purchase invoice can be attached without replacing the first match. Each allocation uses the delivered purchase total minus existing confirmed allocations. Original primary IDs and partial sales source selections remain unchanged. Duplicate matches and ambiguous external invoice/refund retries remain blocked.

Apply `setup.sql`, then `source-lines.sql` before deploying the application. Both scripts are additive to the established invoice allocation, invoice differences, refund sales and partial sales setup. They preserve existing invoice IDs, amounts and refunds; the first match is materialized into the new array only when another invoice is attached. Existing single-invoice `keep` allocations still follow delivery. Confirmed multiple-invoice allocations are fixed; editing their purchase price or delivery requires accounting review, as with approved differences.

The difference refund uses `purchase_difference_invoice_id`, so the VAT, exemption code, product and invoice reference are taken from the invoice that caused the excess. Refund reservations remain included in that invoice's consumed balance. An unresolved previous refund blocks another attachment until its existing issue workflow completes. Completed refund references remain in the match history. An accepted excess is a final acceptance unless its refund is started before attaching another invoice.

Sales source choices include all attached purchase bills with distinct secondary line IDs. Previously partially invoiced source mixes stay locked. This change does not permit changing those mixes or double consuming shared source quantities.

Validation uses synthetic records and stubbed Paraşüt responses; no customer or real invoice contents are needed. Run the normal `node --test tests/*.test.cjs` tests and `tsc --noEmit`, plus:

```
PGLITE_MODULE_PATH=/path/to/@electric-sql/pglite node tests/multiple-purchase-invoices-db.cjs
```

The database integration test installs the established SQL functions, then the new scripts into an isolated PostgreSQL-compatible PGlite database. It checks preservation, cumulative balances, per-source refunds, duplicate/stale rejection, delivery protections, sales source membership and partial source locks.
