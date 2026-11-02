---
name: Published demonstration verification
description: Avoid mistaking development demo data for production donor content.
---

When the user reports an empty published map, verify the actual production URL and read production project records before attributing it to filters or layout.

**Why:** The development preview contained the Gaza demonstration while the live database had no projects. Repeated preview checks gave incorrect reassurance.

**How to apply:** Obtain the current published URL from deployment metadata, request its public project endpoint, and query production read-only. Keep private test projects, accounts, and entitlements out of public demonstration transfers. Distinguish a tested import ready for publishing from a verified live repair.
