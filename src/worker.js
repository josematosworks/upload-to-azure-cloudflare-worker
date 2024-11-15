export default {
  async fetch(request, env) {
    const ALLOWED_ORIGINS = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(';') : null;
    const AZURE_STORAGE_ACCOUNT_NAME = env.AZURE_STORAGE_ACCOUNT_NAME;
    const AZURE_CONTAINER_NAME = env.AZURE_CONTAINER_NAME;
    const SAS_TOKEN = env.SAS_TOKEN;

    // Check if the request's origin is allowed
    const origin = request.headers.get("Origin");
    
    // Create common CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS ? (ALLOWED_ORIGINS.includes(origin) ? origin : null) : "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
        status: 204,
      });
    }

    // For forbidden origins, return 403 with CORS headers
    if (ALLOWED_ORIGINS && !ALLOWED_ORIGINS.includes(origin)) {
      return new Response("Origin not allowed", { 
        status: 403,
        headers: corsHeaders
      });
    }

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

      // Function to generate a GUID
      const generateGuid = () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      // Function to check if a file exists in Azure Blob Storage
      const fileExists = async (fileName) => {
        const azureBlobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${fileName}`;
        const response = await fetch(azureBlobUrl, { method: "HEAD" });
        return response.status === 200; // Returns true if the file exists
      };

      // Encode the file name to handle special characters
      const originalFileName = file.name;
      const fileExtension = originalFileName.split('.').pop(); // Get the file extension
      let uniqueFileName;

      do {
        uniqueFileName = `${generateGuid()}.${fileExtension}`; // Generate a unique file name
      } while (await fileExists(uniqueFileName)); // Check if the file already exists

      // Prepare the Azure Blob URL with SAS token
      const azureBlobUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${uniqueFileName}?${SAS_TOKEN}`;

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

      // Return the public URL and file information
      const publicUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${uniqueFileName}`;
      return new Response(JSON.stringify({
        url: publicUrl,
        filename: originalFileName,
        type: file.type || "application/octet-stream",
        size: file.size
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        },
      });
    }

    // Update the default response to include CORS headers
    return new Response("Only POST requests are allowed", { 
      status: 405,
      headers: corsHeaders
    });
  },
};
