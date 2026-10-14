import json
import unittest
from pathlib import Path

from jsonschema import Draft7Validator


SCHEMA_DIRECTORY = Path(__file__).resolve().parents[3] / "shared" / "packages" / "schemas" / "json"


class ContractSchemaTests(unittest.TestCase):
    def test_chat_request_schema_accepts_valid_request(self):
        schema = json.loads((SCHEMA_DIRECTORY / "assistant-chat-request.schema.json").read_text())
        Draft7Validator(schema).validate({"query": "Find a space poster"})

    def test_chat_request_schema_rejects_blank_or_oversized_query(self):
        schema = json.loads((SCHEMA_DIRECTORY / "assistant-chat-request.schema.json").read_text())
        validator = Draft7Validator(schema)
        self.assertFalse(validator.is_valid({"query": ""}))
        self.assertFalse(validator.is_valid({"query": "x" * 501}))

    def test_chat_response_schema_accepts_contract_shape(self):
        schema = json.loads((SCHEMA_DIRECTORY / "assistant-chat-response.schema.json").read_text())
        Draft7Validator(schema).validate({
            "answer": "Here are a few options.",
            "products": [{"_id": "product-id", "title": "Space Poster", "price": 299}],
        })

    def test_product_schema_accepts_api_product(self):
        schema = json.loads((SCHEMA_DIRECTORY / "product.schema.json").read_text())
        Draft7Validator(schema).validate({
            "_id": "product-id",
            "title": "Space Poster",
            "description": "A framed view of the stars.",
            "price": 299,
            "category": "Space",
            "images": [{"url": "https://example.test/poster.webp"}],
            "stock": 5,
            "sizes": [{"label": "A3", "priceModifier": 20}],
        })


if __name__ == "__main__":
    unittest.main()
