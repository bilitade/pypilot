"""
Simple test script to verify backend integration with thread persistence
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    response = requests.get(f"{BASE_URL}/health")
    print(f"✅ Health check: {response.json()}")
    return response.status_code == 200

def test_chat_simple():
    """Test simple chat without tools"""
    data = {
        "message": "Hello! Please introduce yourself briefly.",
        "thread_id": "test_thread_1"
    }
    response = requests.post(f"{BASE_URL}/chat", json=data)
    result = response.json()
    print(f"\n✅ Simple chat response:")
    print(f"   Thread ID: {result['thread_id']}")
    print(f"   Response: {result['response'][:100]}...")
    tool_calls = result.get('tool_calls') or []
    print(f"   Tool calls: {len(tool_calls)}")
    return response.status_code == 200 and result['thread_id'] == data['thread_id']

def test_thread_persistence():
    """Test thread persistence across requests"""
    thread_id = "test_thread_2"
    
    # First message
    data1 = {
        "message": "My name is Alice. Please remember it.",
        "thread_id": thread_id
    }
    response1 = requests.post(f"{BASE_URL}/chat", json=data1)
    print(f"\n✅ Thread persistence test - Message 1:")
    print(f"   Response: {response1.json()['response'][:80]}...")
        
    # Second message - test memory
    data2 = {
        "message": "What's my name?",
        "thread_id": thread_id
    }
    response2 = requests.post(f"{BASE_URL}/chat", json=data2)
    result2 = response2.json()
    print(f"\n✅ Thread persistence test - Message 2:")
    print(f"   Response: {result2['response'][:150]}...")
    
    # Check if name is remembered
    has_name = "alice" in result2['response'].lower()
    print(f"   Name remembered: {'Yes ' if has_name else 'No '}")
    return has_name

def test_tool_execution():
    """Test tool execution request"""
    data = {
        "message": "Can you list the files in the current directory?",
        "thread_id": "test_thread_3"
    }
    response = requests.post(f"{BASE_URL}/chat", json=data)
    result = response.json()
    
    print(f"\n✅ Tool execution test:")
    print(f"   Response: {result['response'][:100]}...")
    tool_calls = result.get('tool_calls') or []
    print(f"   Tool calls: {len(tool_calls)}")
    if tool_calls:
        for tc in tool_calls:
            print(f"      - {tc['function']['name']}: {tc['function']['arguments'][:50]}...")
    
    return response.status_code == 200

if __name__ == "__main__":
    print("=" * 60)
    print("PyPilot Backend Integration Tests")
    print("=" * 60)
    
    try:
        tests = [
            ("Health Check", test_health),
            ("Simple Chat", test_chat_simple),
            ("Thread Persistence", test_thread_persistence),
            ("Tool Execution", test_tool_execution)
        ]
        
        results = []
        for name, test_func in tests:
            print(f"\n{'='*60}")
            print(f"Running: {name}")
            print('='*60)
            try:
                success = test_func()
                results.append((name, success))
            except Exception as e:
                print(f"❌ Test failed with error: {e}")
                results.append((name, False))
        
        print(f"\n{'='*60}")
        print("Test Summary")
        print('='*60)
        for name, success in results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status}: {name}")
        
        passed = sum(1 for _, s in results if s)
        total = len(results)
        print(f"\nTotal: {passed}/{total} tests passed")
        
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()
