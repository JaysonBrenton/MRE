#!/usr/bin/env python3
"""
Test script to debug practice day discovery endpoint
"""
import requests
import json
import sys

# Test parameters
TRACK_ID = "2aba913f-eb28-4b11-9f67-e9fdbdf52172"
TRACK_SLUG = "canberraoffroad"
YEAR = 2025
MONTH = 10

# Backend service URL
BASE_URL = "http://localhost:8000"

print("=" * 80)
print("Testing Practice Day Discovery")
print("=" * 80)
print(f"Track ID: {TRACK_ID}")
print(f"Track Slug: {TRACK_SLUG}")
print(f"Year: {YEAR}")
print(f"Month: {MONTH}")
print()

# Test 1: Direct backend call with track_slug
print("Test 1: Direct backend discover endpoint (POST /api/v1/practice-days/discover)")
print("-" * 80)
payload = {
    "track_slug": TRACK_SLUG,
    "year": YEAR,
    "month": MONTH
}
print(f"Payload: {json.dumps(payload, indent=2)}")
try:
    response = requests.post(
        f"{BASE_URL}/api/v1/practice-days/discover",
        json=payload,
        timeout=30
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Headers: {dict(response.headers)}")
    print(f"Response Body: {response.text}")
    if response.status_code == 200:
        data = response.json()
        print(f"Success: {data.get('success')}")
        if data.get('success'):
            practice_days = data.get('data', {}).get('practice_days', [])
            print(f"Practice Days Found: {len(practice_days)}")
            if practice_days:
                print(f"First practice day: {json.dumps(practice_days[0], indent=2, default=str)}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print()
print()

# Test 2: Check what the Next.js API route receives
print("Test 2: Next.js API route (POST /api/v1/practice-days/discover)")
print("-" * 80)
payload = {
    "track_id": TRACK_ID,
    "year": YEAR,
    "month": MONTH
}
print(f"Payload: {json.dumps(payload, indent=2)}")
try:
    response = requests.post(
        "http://localhost:3001/api/v1/practice-days/discover",
        json=payload,
        timeout=30
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print()
print()

# Test 3: Search endpoint
print("Test 3: Search endpoint (GET /api/v1/practice-days/search)")
print("-" * 80)
params = {
    "track_id": TRACK_ID,
    "start_date": "2025-10-01",
    "end_date": "2025-10-31"
}
print(f"Params: {params}")
try:
    response = requests.get(
        f"{BASE_URL}/api/v1/practice-days/search",
        params=params,
        timeout=30
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
