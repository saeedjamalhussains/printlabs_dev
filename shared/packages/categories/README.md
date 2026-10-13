# @printlabs/categories

This package holds the shared category vocabulary used by the API and the admin dashboard.

It is used for parsing and normalizing stored category strings; product pricing and catalog logic do not belong here.

It does not belong in app code or database logic; keep category parsing rules in this package and keep business rules outside it.
