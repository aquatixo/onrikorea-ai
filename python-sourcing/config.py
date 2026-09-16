import os
from dotenv import load_dotenv

# Loads the project's .env from the current working directory (the Node Server Action
# spawns this with cwd set to the project root, so this finds the same .env Next.js uses).
load_dotenv()

BRAVE_SEARCH_API_KEY = os.environ.get("BRAVE_SEARCH_API_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
APP_BASE_URL = os.environ.get("APP_BASE_URL", "http://localhost:3000")

MAX_CANDIDATES_PER_BUCKET = 6
