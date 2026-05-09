const checks = [
  "https://jaypv-os.jaypventuresllc.com/health.json",
  "https://jaypv-os.jaypventuresllc.com/entitlements/status.json"
];

for (const url of checks) {
  const response = await fetch(url);

  if (!response.ok) {
    console.error(`Verification failed: ${url} returned ${response.status}`);
    process.exit(1);
  }

  const data = await response.json();
  console.log(`Verified ${url}`);
  console.log(data);
}
