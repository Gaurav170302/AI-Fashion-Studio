async function testPollinations() {
  const url = "https://image.pollinations.ai/prompt/test?width=768&height=1024&nologo=true";
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.headers.get("content-type"));
  } catch (err) {
    console.error("Error:", err);
  }
}
testPollinations();
