# Upload to Azure Cloudflare Worker

This project is a Cloudflare Worker that allows users to upload files to Azure Blob Storage. It validates the request, checks for allowed origins, and ensures that the uploaded file has a unique name before storing it in Azure.

## Features

- **File Upload**: Supports uploading files via `POST` requests.
- **Origin Validation**: Checks if the request's origin is allowed based on environment variables.
- **Unique File Naming**: Generates a unique GUID for each uploaded file to prevent overwrites.
- **Azure Blob Storage Integration**: Directly uploads files to Azure Blob Storage using a SAS token.

## Environment Variables

To run this project, you need to set the following environment variables:

- `AZURE_STORAGE_ACCOUNT_NAME`: Your Azure Storage account name.
- `AZURE_CONTAINER_NAME`: The name of the Azure Blob Storage container.
- `SAS_TOKEN`: The Shared Access Signature token for authentication.
- `ALLOWED_ORIGINS`: A semicolon-separated list of allowed origins for CORS.

## Usage

1. **Clone the repository**:

   ```bash
   git clone https://github.com/josematosworks/upload-to-azure-cloudflare-worker.git
   cd upload-to-azure-cloudflare-worker
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Run the worker locally**:

   ```bash
   npm run dev
   ```

4. **Deploy to Cloudflare Workers**:
   ```bash
   npm run deploy
   ```

## API Endpoint

The worker listens for `POST` requests at the root URL. The request must include a file in `multipart/form-data` format.

### Request Example

```bash
curl -X POST https://your-cloudflare-worker-url \
  -H "Content-Type: multipart/form-data" \
  -F "file=@/path/to/your/file.txt"
```
### Response

On successful upload, the response will include the public URL of the uploaded file:

```json
{
  "url": "https://<AZURE_STORAGE_ACCOUNT_NAME>.blob.core.windows.net/<AZURE_CONTAINER_NAME>/<uniqueFileName>"
}
```

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
