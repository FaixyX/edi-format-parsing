import os

try:
    from dotenv import dotenv_values, load_dotenv

    load_dotenv()
    # Also load .env values directly to avoid Windows env var overrides
    _dotenv_values = dotenv_values()
except Exception:
    _dotenv_values = {}


def _get_env(key: str, default: str = None) -> str:
    """
    Get env value, preferring .env file values over system env vars.
    This prevents Windows system env vars (like USERNAME) from overriding .env values.
    """
    # First check .env file values (not overridden by system)
    if key in _dotenv_values and _dotenv_values[key]:
        return _dotenv_values[key].strip().strip('"').strip("'")
    # Then fall back to os.getenv
    return os.getenv(key, default)


def _get_decodo_settings():
    """Fetch Decodo settings fresh each call to avoid stale env in long-lived processes."""
    host = _get_env("HOST", "isp.decodo.com")
    port = int(_get_env("proxy_PORT", "10001"))
    username = _get_env("USERNAME")
    password = _get_env("PASSWORD")
    return host, port, username, password


def build_la_rotating_proxy() -> dict:
    """
    Build a Playwright proxy config for Los Angeles residential proxies
    using a rotating port.
    """
    host, port, username, password = _get_decodo_settings()

    if not username or not password:
        raise RuntimeError("Decodo proxy credentials are not configured")

    server = f"http://{host}:{port}"

    return {
        "server": server,
        "username": username,
        "password": password,
    }


def get_decodo_env_info():
    """Expose current Decodo env values for diagnostics (non-secret)."""
    host, port, username, _ = _get_decodo_settings()
    return {
        "proxy_host": host,
        "proxy_port": port,
        "has_username": bool(username),
    }
