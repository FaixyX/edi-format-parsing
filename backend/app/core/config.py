import os
from dotenv import load_dotenv

load_dotenv()

# Security: No default fallbacks for sensitive values
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is required and must be set")

ALGORITHM = "HS256"

# Admin credentials with secure defaults
VALID_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
VALID_PASSWORD = os.getenv("ADMIN_PASSWORD", "password")
