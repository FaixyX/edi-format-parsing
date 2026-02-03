import requests

# Test with user-provided credentials
print("Testing proxy with user-provided credentials...")
url = "https://ip.decodo.com/json"
username = "spd0wlqwl3"
password = "w+9z0i7DtDT4qeNnik"
proxy = f"http://{username}:{password}@isp.decodo.com:10001"

try:
    result = requests.get(url, proxies={"http": proxy, "https": proxy}, timeout=10)
    print(f"Status Code: {result.status_code}")
    print(f"Response: {result.text}")
    print("[SUCCESS] Proxy test successful!")
except Exception as e:
    print(f"[FAILED] Proxy test failed: {e}")

print("\n" + "=" * 50 + "\n")

# Test with current credentials from the file
print("Testing proxy with current credentials from decodo_proxy.py...")
username_current = "sp45mc9uwh"
password_current = "V2EwCA~nttvwo67yj6"
proxy_current = f"http://{username_current}:{password_current}@isp.decodo.com:10001"

try:
    result = requests.get(
        url, proxies={"http": proxy_current, "https": proxy_current}, timeout=10
    )
    print(f"Status Code: {result.status_code}")
    print(f"Response: {result.text}")
    print("[SUCCESS] Proxy test successful!")
except Exception as e:
    print(f"[FAILED] Proxy test failed: {e}")
