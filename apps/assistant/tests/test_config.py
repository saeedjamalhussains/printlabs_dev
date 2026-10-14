import unittest

from app.config import Settings, verify_required_settings


class RequiredSettingsTests(unittest.TestCase):
    def make_settings(self, **values):
        settings = {
            "OPENROUTER_API_KEY": "test_openrouter_key",
            "INTERNAL_API_KEY": "test_internal_key_for_contract_checks_123456",
        }
        settings.update(values)
        return Settings(_env_file=None, **settings)

    def test_rejects_empty_required_credentials(self):
        settings = self.make_settings(OPENROUTER_API_KEY="")
        with self.assertRaisesRegex(RuntimeError, "OPENROUTER_API_KEY"):
            verify_required_settings(settings)

    def test_rejects_example_placeholders(self):
        settings = self.make_settings(OPENROUTER_API_KEY="replace-with-key")
        with self.assertRaisesRegex(RuntimeError, "OPENROUTER_API_KEY"):
            verify_required_settings(settings)

    def test_rejects_short_internal_key(self):
        settings = self.make_settings(INTERNAL_API_KEY="short")
        with self.assertRaisesRegex(RuntimeError, "at least 32 characters"):
            verify_required_settings(settings)

    def test_accepts_test_credentials(self):
        verify_required_settings(self.make_settings())


if __name__ == "__main__":
    unittest.main()
