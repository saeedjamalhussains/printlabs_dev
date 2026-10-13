# @printlabs/guards

This package holds shared guard rails that both the browser and the API must apply the same way.

It is used by the storefront and the assistant to prevent payment questions from slipping past the public UI into unsupported flows.

It does not belong in app code or database logic; keep rule checks here and keep app behavior outside this package.
