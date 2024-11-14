export default {
  async fetch(request, env) {
    const ALLOWED_ORIGIN = env.ALLOWED_ORIGIN;
    const AZURE_STORAGE_ACCOUNT_NAME = env.AZURE_STORAGE_ACCOUNT_NAME;
    const AZURE_CONTAINER_NAME = env.AZURE_CONTAINER_NAME;
    const SAS_TOKEN = env.SAS_TOKEN;

    const MAXIMUM_WIDTH = 800; // Set your desired maximum width
    const IMAGE_QUALITY = 80; // Set your desired image quality (1-100)

    if (request.method === "POST") {
      // Ensure the request has a file
      const contentType = request.headers.get("Content-Type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return new Response("Invalid Content-Type", { status: 400 });
      }

      // Extract the file from the form data
      const formData = await request.formData();
      let file = formData.get("file"); // "file" is the field name in the form
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

      // Function to resize the image
      const resizeImage = async (file) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        return new Promise((resolve) => {
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            let width = img.width;
            let height = img.height;

            if (width > MAXIMUM_WIDTH) {
              height = (height * MAXIMUM_WIDTH) / width;
              width = MAXIMUM_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => resolve(blob), file.type, IMAGE_QUALITY / 100);
          };
        });
      };

      if (file.type.startsWith("image/")) {
        file = await resizeImage(file); // Resize and compress the image
      }

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
      const publicUrl = `https://${AZURE_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${AZURE_CONTAINER_NAME}/${uniqueFileName}`;
      return new Response(JSON.stringify({ url: publicUrl }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Default response for non-POST requests
    return new Response("Only POST requests are allowed", { status: 405 });
  },
};
