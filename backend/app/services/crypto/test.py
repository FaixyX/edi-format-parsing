import requests

url = "https://ip.decodo.com/json"
username = "sp45mc9uwh"
password = "V2EwCA~nttvwo67yj6"
proxy = f"http://{username}:{password}@city.decodo.com:21050"
result = requests.get(url, proxies={"http": proxy, "https": proxy})
print(result.text)
