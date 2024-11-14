export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN;
    const AZURE_STORAGE_ACCOUNT_NAME = env.AZURE_STORAGE_ACCOUNT_NAME;
    const AZURE_CONTAINER_NAME = env.AZURE_CONTAINER_NAME;
    const SAS_TOKEN = env.SAS_TOKEN;

    if (request.method === "POST") {
      // Ensure the request has a file
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response("Invalid Content-Type", { status: 400 });
      }

      // Extract the file from the form data
      const formData = await request.formData();
      const file = formData.get("file"); // "file" is the field name in the form
      if (!file || !file.name || !file.stream) {
        return new Response("File not provided or invalid", { status: 400 });
      }

      // Encode the file name to handle special characters
      const encodedFileName = encodeURIComponent(file.name);

      // Prepare the Azure Blob URL with SAS token
      const azureBlobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${encodedFileName}?${SAS_TOKEN}`;

      // Send file to Azure Blob Storage without additional authentication headers
      const azureResponse = await fetch(azureBlobUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file.stream(),
      });

      // Add logging for the Azure response
      console.log("Azure Response Status:", azureResponse.status);
      console.log("Azure Response Status Text:", azureResponse.statusText);
      const responseBody = await azureResponse.text();
      console.log("Azure Response Body:", responseBody);

      if (!azureResponse.ok) {
        return new Response(`Failed to upload file to Azure: ${responseBody}`, {
          status: 500,
        });
      }

      // Return the public URL of the uploaded file
      const publicUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${encodedFileName}`;
      return new Response(JSON.stringify({ url: publicUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default response for non-POST requests
    return new Response("Only POST requests are allowed", { status: 405 });
  },
};
