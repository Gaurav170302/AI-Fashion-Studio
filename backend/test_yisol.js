import { Client } from '@gradio/client';

async function testIDM() {
  try {
    const client = await Client.connect('yisol/IDM-VTON');
    console.log("Connected to Space yisol/IDM-VTON");
    
    // just try to see if it connected
  } catch (err) {
    console.error("Error:", err);
  }
}

testIDM();
