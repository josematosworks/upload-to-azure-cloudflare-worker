export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN;
    const AZURE_STORAGE_ACCOUNT_NAME = env.AZURE_STORAGE_ACCOUNT_NAME;
    const AZURE_STORAGE_ACCOUNT_KEY = env.AZURE_STORAGE_ACCOUNT_KEY;
    const AZURE_CONTAINER_NAME = env.AZURE_CONTAINER_NAME;

    if (request.method === "POST") {
      // Ensure the request has a file
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response("Invalid Content-Type", { status: 400 });
      }

      // Extract the file from the form data
      const formData = await request.formData();
      const file = formData.get("file"); // "file" is the field name in the form
      if (!file?.name || !file?.stream) {
        return new Response("File not provided or invalid", { status: 400 });
      }

      // Prepare the necessary Azure details
      const azureBlobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${file.name}`;

      // Prepare the upload headers, including authentication with Shared Key
      const accessKey = AZURE_STORAGE_ACCOUNT_KEY;
      const blobServiceUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net`;
      const blobPath = `/${AZURE_CONTAINER_NAME}/${file.name}`;
      const date = new Date().toUTCString();

      // Check if the Azure Storage Account Key is provided
      if (!AZURE_STORAGE_ACCOUNT_KEY) {
        return new Response("Azure Storage Account Key is not set", { status: 500 });
      }

      const stringToSign = `PUT\n\n\n${file.size}\n\n${file.type}\n\n\n\n\n\n\nx-ms-blob-type:BlockBlob\nx-ms-date:${date}\nx-ms-version:2020-10-02\n/${AZURE_STORAGE_ACCOUNT_NAME}${blobPath}`;
      const signature = await crypto.subtle
        .importKey(
          "raw",
          new TextEncoder().encode(accessKey),
          { name: "HMAC", hash: "SHA-256" },
          false,
          ["sign"]
        )
        .then((key) =>
          crypto.subtle.sign(
            "HMAC",
            key,
            new TextEncoder().encode(stringToSign)
          )
        )
        .then((signatureBuffer) =>
          Array.from(new Uint8Array(signatureBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
        );

      const authHeader = `SharedKey ${AZURE_STORAGE_ACCOUNT_NAME}:${signature}`;

      // Send file to Azure Blob Storage
      const azureResponse = await fetch(azureBlobUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "x-ms-date": date,
          "x-ms-version": "2020-10-02",
          Authorization: authHeader,
          "Content-Length": file.size,
          "Content-Type": file.type,
        },
        body: file.stream(),
      });

      // Add logging for the azureResponse
      console.log("azureResponse status:", azureResponse.status);
      console.log("azureResponse statusText:", azureResponse.statusText);
      const responseBody = await azureResponse.text(); // Capture the response body
      console.log("azureResponse body:", responseBody);

      if (!azureResponse.ok) {
        return new Response(
          `Failed to upload file to Azure: ${responseBody}`,
          { status: 500 }
        );
      }

      // Return the public URL
      const publicUrl = `${blobServiceUrl}/${AZURE_CONTAINER_NAME}/${file.name}`;
      return new Response(JSON.stringify({ url: publicUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default response for non-POST requests
    return new Response("Only POST requests are allowed", { status: 405 });
  },
};
