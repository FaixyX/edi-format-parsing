// Quick test script to verify backend connection
// Run: node test-backend-connection.js

const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/v1';

async function testConnection() {
  console.log('Testing backend connection...');
  console.log('API URL:', API_URL);
  
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend is connected!');
      console.log('Response:', data);
    } else {
      console.log('⚠️ Backend responded but with status:', response.status);
    }
  } catch (error) {
    console.error('❌ Failed to connect to backend:', error.message);
    console.log('Make sure your backend is running on', API_URL);
  }
}

testConnection();
