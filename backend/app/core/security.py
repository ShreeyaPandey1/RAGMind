import re
import os
import hashlib
from typing import Tuple

# Allowed characters in safe filename: alphanumeric, dot, underscore, dash
SAFE_FILENAME_REGEX = re.compile(r'[^a-zA-Z0-9_.-]')

def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and dangerous characters."""
    base_name = os.path.basename(filename)
    clean_name = SAFE_FILENAME_REGEX.sub('_', base_name)
    if not clean_name or clean_name.startswith('.'):
        clean_name = f"doc_{clean_name.lstrip('.')}"
    return clean_name

def calculate_sha256(content: bytes) -> str:
    """Calculate SHA-256 hash of raw file bytes."""
    hasher = hashlib.sha256()
    hasher.update(content)
    return hasher.hexdigest()

def is_safe_path(base_dir: str, target_path: str) -> bool:
    """Verify that target_path resides within base_dir to prevent path traversal."""
    resolved_base = os.path.abspath(base_dir)
    resolved_target = os.path.abspath(target_path)
    return resolved_target.startswith(resolved_base)

def sanitize_user_input(text: str, max_chars: int = 4000) -> str:
    """Trim and sanitize user input to avoid prompt buffer overflows."""
    if not text:
        return ""
    return text.strip()[:max_chars]
