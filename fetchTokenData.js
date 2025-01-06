async function fetchTokenData(contractAddress) {
  if (!contractAddress) throw new Error("No contract address provided.");

  const options = {
    method: "GET",
    headers: {
      accept: "application/json",
      "X-API-Key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6ImE2N2ZlN2MyLWUwMTQtNDc3OC04ZDU5LWE0MzViNWJkMjFlNyIsIm9yZ0lkIjoiMjE1MTcxIiwidXNlcklkIjoiMjE0ODU3IiwidHlwZUlkIjoiNDU3MTA0YTQtNTYyYy00NThhLThkYmUtZmZmYjUyNWE2YjFhIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3MzQ4MTY1ODAsImV4cCI6NDg5MDU3NjU4MH0.pEr1qsW7YidPiU5I1wk8gHfO3oBIMX10ORi4zb1M81o",
    },
  };

  const response = await fetch(
    `https://solana-gateway.moralis.io/token/mainnet/${contractAddress}/metadata`,
    options
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || response.statusText);
  }

  const data = await response.json();
  const metadataUri = data?.metaplex?.metadataUri;
  if (!metadataUri) throw new Error("Metadata URI missing in token data.");

  const metadata = await fetchMetadata(metadataUri);
  return metadata;
}

async function fetchMetadata(uri) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`Failed to fetch metadata: ${response.statusText}`);
  return await response.json();
}

module.exports = { fetchTokenData, fetchMetadata };
