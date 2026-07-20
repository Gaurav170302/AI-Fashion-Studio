import { Client } from '@gradio/client';

async function testIDM() {
  try {
    const client = await Client.connect('Nymbo/Virtual-Try-On');
    console.log("Connected to Space");
  } catch (err) {
    console.error("Error:", err);
  }
}

testIDM();
