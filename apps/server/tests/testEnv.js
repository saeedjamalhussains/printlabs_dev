const testEnvironment = {
  NODE_ENV: 'test',
  JWT_SECRET: 'test_only_jwt_secret_value_with_more_than_32_chars',
  CLOUDINARY_CLOUD_NAME: 'testcloud',
  CLOUDINARY_API_KEY: 'testkey',
  CLOUDINARY_API_SECRET: 'testsecret',
  RAZORPAY_KEY_ID: 'rzp_test_key',
  RAZORPAY_KEY_SECRET: 'test_razorpay_secret',
  INTERNAL_API_KEY: 'test_only_internal_api_key_with_more_than_32_chars',
};

for (const [key, value] of Object.entries(testEnvironment)) {
  process.env[key] = value;
}
