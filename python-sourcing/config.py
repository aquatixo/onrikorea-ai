import os
from dotenv import load_dotenv

# Loads the project's .env from the current working directory (the Node Server Action
# spawns this with cwd set to the project root, so this finds the same .env Next.js uses).
load_dotenv()

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# "gemini-flash-latest" tracks whatever Google's current default Flash model is, rather
# than pinning a dated model id that eventually gets deprecated -- per Google's own docs
# example for the Interactions API / google_search tool.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")

MAX_CANDIDATES_PER_BUCKET = 6
