// Test script for AI Navigator integration
import { buildAssistantResponse } from './index.js';

async function testAssistant() {
  console.log('Testing AI Navigator integration...');
  
  try {
    // Test 1: Basic greeting
    console.log('\n1. Testing basic greeting:');
    const response1 = await buildAssistantResponse('Hai, apa yang bisa kamu lakukan?');
    console.log('Response:', response1.reply);
    console.log('Suggestions:', response1.suggestions);
    
    // Test 2: Convert question
    console.log('\n2. Testing convert question:');
    const response2 = await buildAssistantResponse('Bagaimana cara convert video YouTube?');
    console.log('Response:', response2.reply);
    console.log('Suggestions:', response2.suggestions);
    
    // Test 3: Walkthrough command
    console.log('\n3. Testing walkthrough command:');
    const response3 = await buildAssistantResponse('/walkthrough');
    console.log('Response:', response3.reply);
    console.log('Suggestions:', response3.suggestions);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
  }
}

// Run the test
testAssistant();
