async function testPollinations() {
  const seed = 1234;
  const prompt = "handsome male fashion model wearing a t-shirt, casual streetwear look, standing full body portrait, studio background, professional fashion photography, photorealistic, 4K, well lit";
  const encoded = encodeURIComponent(prompt);
  let url = `https://image.pollinations.ai/prompt/${encoded}?width=768&height=1024&seed=${seed}&model=flux&enhance=true&nologo=true`;
  const garmentPublicUrl = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=90&w=800&auto=format&fit=crop";
  
  if (garmentPublicUrl) {
    url += `&image=${encodeURIComponent(garmentPublicUrl)}`;
  }
  
  console.log("URL:", url);
  try {
    const res = await fetch(url);
    console.log("Status:", res.status, res.headers.get("content-type"));
  } catch (err) {
    console.error("Error:", err);
  }
}
testPollinations();
