"""
Test script to validate Decodo proxy environment variables and connection.
This script checks if all required env vars are set correctly and tests the proxy connection.
"""

import os
import sys
import requests
from urllib.parse import quote
from typing import Dict, Optional, Tuple

try:
    from dotenv import dotenv_values, load_dotenv

    load_dotenv()
    _dotenv_values = dotenv_values()
except Exception as e:
    print(f"[WARNING] Could not load .env file: {e}")
    _dotenv_values = {}


def _get_env(key: str, default: str = None) -> Optional[str]:
    """
    Get env value, preferring .env file values over system env vars.
    This prevents Windows system env vars (like USERNAME) from overriding .env values.
    """
    # First check .env file values (not overridden by system)
    if key in _dotenv_values and _dotenv_values[key]:
        return _dotenv_values[key].strip().strip('"').strip("'")
    # Then fall back to os.getenv
    return os.getenv(key, default)


def mask_sensitive(value: str, show_chars: int = 4) -> str:
    """Mask sensitive values, showing only first few characters."""
    if not value:
        return "None"
    if len(value) <= show_chars:
        return "*" * len(value)
    return value[:show_chars] + "*" * (len(value) - show_chars)


def check_env_vars() -> Dict[str, Tuple[bool, Optional[str], str]]:
    """
    Check all required environment variables.
    Returns dict with key -> (is_set, value, source)
    """
    results = {}

    # Required variables
    vars_to_check = {
        "HOST": ("isp.decodo.com", "Proxy host"),
        "proxy_PORT": ("10001", "Proxy port"),
        "USERNAME": (None, "Proxy username"),
        "PASSWORD": (None, "Proxy password"),
    }

    for var_name, (default, description) in vars_to_check.items():
        # Check .env file first
        from_env_file = _dotenv_values.get(var_name)
        from_system = os.getenv(var_name)

        if from_env_file:
            value = from_env_file.strip().strip('"').strip("'")
            source = ".env file"
            is_set = bool(value)
        elif from_system:
            value = from_system
            source = "system environment"
            is_set = bool(value)
        else:
            value = default
            source = "default" if default else "not set"
            is_set = bool(value) if default else False

        results[var_name] = (is_set, value, source)

    return results


def test_proxy_connection(
    host: str, port: int, username: str, password: str, use_url_encoding: bool = False
) -> Tuple[bool, str, Optional[Dict]]:
    """
    Test proxy connection by making a request through it.
    Returns (success, message, response_data)
    """
    try:
        # URL encode username and password if needed (for special characters like ~)
        if use_url_encoding:
            encoded_username = quote(username, safe="")
            encoded_password = quote(password, safe="")
            proxy_url = f"http://{encoded_username}:{encoded_password}@{host}:{port}"
        else:
            proxy_url = f"http://{username}:{password}@{host}:{port}"

        proxies = {
            "http": proxy_url,
            "https": proxy_url,
        }

        # Test URL that returns IP information
        test_url = "https://ip.decodo.com/json"

        print(f"\n[TEST] Attempting connection through proxy...")
        print(f"       Proxy: {host}:{port}")
        print(f"       Username: {mask_sensitive(username)}")

        response = requests.get(test_url, proxies=proxies, timeout=15)

        if response.status_code == 200:
            try:
                data = response.json()
                return True, "Connection successful!", data
            except:
                return (
                    True,
                    f"Connection successful! Status: {response.status_code}",
                    None,
                )
        else:
            return (
                False,
                f"Connection failed with status code: {response.status_code}",
                None,
            )

    except requests.exceptions.ProxyError as e:
        return False, f"Proxy error: {str(e)}", None
    except requests.exceptions.Timeout:
        return False, "Connection timeout - proxy may be unreachable", None
    except requests.exceptions.ConnectionError as e:
        return False, f"Connection error: {str(e)}", None
    except Exception as e:
        return False, f"Unexpected error: {str(e)}", None


def main():
    print("=" * 70)
    print("DECODO PROXY ENVIRONMENT VARIABLE TEST")
    print("=" * 70)

    # Check environment variables
    print("\n[1] Checking Environment Variables...")
    print("-" * 70)

    env_results = check_env_vars()
    all_set = True

    for var_name, (is_set, value, source) in env_results.items():
        status = "[OK] SET" if is_set else "[X] MISSING"
        if not is_set:
            all_set = False

        if var_name in ["USERNAME", "PASSWORD"]:
            display_value = mask_sensitive(value) if value else "None"
        else:
            display_value = value if value else "None"

        print(f"  {status:10} {var_name:15} = {display_value:20} (from: {source})")

    print("-" * 70)

    if not all_set:
        print("\n[ERROR] Some required environment variables are missing!")
        print("        Please set the following variables in your .env file:")
        print("        - HOST (or use default: isp.decodo.com)")
        print("        - proxy_PORT (or use default: 10001)")
        print("        - USERNAME (required)")
        print("        - PASSWORD (required)")
        print("\n        Example .env file:")
        print("        HOST=isp.decodo.com")
        print("        proxy_PORT=10001")
        print("        USERNAME=your_username")
        print("        PASSWORD=your_password")
        return 1

    # Get values for testing
    host = env_results["HOST"][1] or "isp.decodo.com"
    port_str = env_results["proxy_PORT"][1] or "10001"

    try:
        port = int(port_str)
    except ValueError:
        print(f"\n[ERROR] Invalid port value: {port_str}")
        return 1

    username = env_results["USERNAME"][1]
    password = env_results["PASSWORD"][1]

    if not username or not password:
        print("\n[ERROR] USERNAME and PASSWORD are required for proxy connection!")
        return 1

    # Test proxy connection
    print("\n[2] Testing Proxy Connection...")
    print("-" * 70)

    # First try without URL encoding
    success, message, response_data = test_proxy_connection(
        host, port, username, password, use_url_encoding=False
    )

    if not success and ("407" in message or "Unauthorized" in message):
        print(f"[INFO] First attempt failed: {message}")
        print(
            "\n[INFO] Retrying with URL-encoded credentials (for special characters)..."
        )
        success, message, response_data = test_proxy_connection(
            host, port, username, password, use_url_encoding=True
        )

    if success:
        print(f"[SUCCESS] {message}")
        if response_data:
            print(f"\n       Response data:")
            for key, value in response_data.items():
                print(f"         {key}: {value}")
    else:
        print(f"[FAILED] {message}")
        print("\n[DIAGNOSTICS]")
        print("  - Check if the proxy host and port are correct")
        print("  - Verify your username and password are valid")
        print("  - Ensure your network can reach the proxy server")
        print("  - Check if your Decodo account is active")
        print("  - Special characters in password may need URL encoding")
        print("\n[SUGGESTIONS]")
        print("  1. Verify credentials in your Decodo dashboard")
        print("  2. Check if your account subscription is active")
        print("  3. Try using the credentials from test_decodo_proxy.py:")
        print("     - Username: spd0wlqwl3")
        print("     - Password: w+9z0i7DtDT4qeNnik")
        return 1

    print("\n" + "=" * 70)
    print("[RESULT] All checks passed! Proxy configuration is correct.")
    print("=" * 70)
    return 0


if __name__ == "__main__":
    sys.exit(main())
