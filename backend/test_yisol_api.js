import { Client } from '@gradio/client';

async function testIDM() {
  try {
    const client = await Client.connect('yisol/IDM-VTON');
    const api = await client.view_api();
    console.log(JSON.stringify(api, null, 2));
  } catch (err) {
    console.error("Error:", err);
  }
}

testIDM();
