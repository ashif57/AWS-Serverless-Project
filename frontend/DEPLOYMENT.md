# AWS Deployment Guide: S3 + CloudFront + ACM + Route 53

This guide details how to host and deploy the static frontend for the AWS Serverless URL Shortener and integrate it with your backend API.

---

## Architecture Overview

```
[ User Browser ] 
       │ (HTTPS Request to url.yourdomain.com)
       ▼
[ Amazon Route 53 ] (DNS Routing)
       │
       ▼
[ Amazon CloudFront ] (Global CDN Edge) ◄── [ AWS Certificate Manager (ACM) ] (SSL Certificate)
       │ (Origin Access Control - Secure Private S3 Bridge)
       ▼
[ Amazon S3 Bucket ] (Hosting static index.html, style.css, app.js)
```

---

## Method 1: Automated Deployment via CloudFormation (Recommended)

The easiest way to deploy this infrastructure is by using the provided `frontend-deploy.yaml` template. 

### Prerequisites
1. An active custom domain name (e.g., `example.com` or `short.example.com`).
2. A **Route 53 Hosted Zone** created in your AWS account for that domain.
3. **AWS CLI** installed and configured, or access to the **AWS CloudFormation Console**.

### Deployment Steps (AWS CLI)
Since CloudFront requires SSL certificates to be in the **`us-east-1` (N. Virginia)** region, you **must deploy this CloudFormation stack in the `us-east-1` region** if you are automatically generating the ACM certificate:

```bash
aws cloudformation deploy \
  --template-file frontend-deploy.yaml \
  --stack-name url-shortener-frontend \
  --parameter-overrides \
      DomainName="url.yourdomain.com" \
      Route53HostedZoneId="Z0123456789ABCDEF" \
  --region us-east-1
```
*Replace `url.yourdomain.com` and `Z0123456789ABCDEF` with your custom domain and Hosted Zone ID.*

### Deployment Steps (AWS Console)
1. Log into the AWS Console and navigate to **CloudFormation** (make sure your region is set to **`us-east-1` / N. Virginia**).
2. Click **Create stack** -> **With new resources (standard)**.
3. Choose **Upload a template file** and select [frontend-deploy.yaml](file:///D:/Ashif/projects/AWS-Serverless-Project/frontend/frontend-deploy.yaml).
4. Fill in the parameters:
   - `DomainName`: e.g., `url.yourdomain.com`
   - `Route53HostedZoneId`: e.g., `Z0123456789ABCDEF`
5. Proceed through the configuration steps and click **Submit**.
6. **Important**: If you are creating a new certificate, the stack will transition to `CREATE_IN_PROGRESS` while waiting for the DNS Certificate validation to complete. Route 53 records will be automatically added by CloudFormation to validate the domain ownership. This takes about 3-5 minutes.

---

## Method 2: Manual Console Deployment

If you prefer to configure the resources manually, follow these steps:

### 1. Create S3 Bucket
1. Navigate to **S3** -> **Create bucket**.
2. Give it a name (e.g. `my-url-shortener-frontend-bucket`).
3. Set **Object Ownership** to *ACLs disabled*.
4. Check **Block all public access** (highly recommended, as CloudFront will access the bucket securely).
5. Click **Create bucket**.

### 2. Request ACM SSL Certificate
1. Navigate to **AWS Certificate Manager** (verify your region is **`us-east-1` (N. Virginia)**).
2. Click **Request** -> **Request a public certificate**.
3. Add your domain name (e.g., `url.yourdomain.com`).
4. Select **DNS validation** and click **Request**.
5. Once created, click on the Certificate ID and select **Create records in Route 53** to complete validation.

### 3. Create CloudFront Distribution
1. Navigate to **CloudFront** -> **Create distribution**.
2. **Origin Domain**: Select your S3 bucket.
3. **Origin Access**: Select **Origin access control settings (recommended)**. Click **Create control setting** and accept defaults.
4. **Viewer Protocol Policy**: Select **Redirect HTTP to HTTPS**.
5. **Alternative Domain Names (CNAME)**: Add your custom domain (e.g., `url.yourdomain.com`).
6. **Custom SSL Certificate**: Select the ACM certificate you created in step 2.
7. **Default Root Object**: Enter `index.html`.
8. Click **Create distribution**.
9. **Bucket Policy Update**: Once the distribution is created, copy the generated S3 Bucket Policy from the CloudFront warning banner. Go back to your S3 bucket under **Permissions** -> **Bucket Policy** -> **Edit** and paste this policy so CloudFront can read your files.

### 4. Create Route 53 DNS Record
1. Navigate to **Route 53** -> **Hosted zones** -> Select your domain zone.
2. Click **Create record**.
3. **Record name**: Enter your subdomain (e.g. `url`).
4. **Record type**: `A - Routes traffic to an IPv4 address and some AWS resources`.
5. Toggle **Alias** to ON.
6. **Route traffic to**: Choose *Alias to CloudFront distribution*.
7. Select your CloudFront distribution from the dropdown list.
8. Click **Create records**.

---

## Critical Integration Step: Configure CORS in API Gateway

Because your frontend (e.g., `url.yourdomain.com`) and your backend API Gateway (e.g., `https://a1b2c3d4.execute-api.us-east-1.amazonaws.com`) reside on different domains, the user's browser will trigger a **Cross-Origin Resource Sharing (CORS)** preflight check (`OPTIONS` request). 

If CORS is not configured, the request will be blocked by the browser.

### Step 1: Enable CORS in AWS Console (API Gateway)
1. Go to **API Gateway** in the AWS Console and select your URL Shortener REST API.
2. Click on the `/create` resource.
3. Click **Actions** (or the **Enable CORS** button at the top).
4. Under CORS Settings:
   - Access-Control-Allow-Headers: `'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'`
   - Access-Control-Allow-Origin: `'*'` (or `'https://url.yourdomain.com'`)
   - Access-Control-Allow-Methods: `'DEFAULT'` or `'OPTIONS,POST'`
5. Click **Enable CORS and replace existing CORS headers**.
6. Select **Actions** -> **Deploy API**. Choose your deployment stage (e.g., `prod`).

### Step 2: Return CORS Headers in Lambda
When API Gateway uses Lambda Proxy Integration, enabling CORS in the API Gateway UI only handles the `OPTIONS` preflight request. Your actual Lambda function **must** also return the CORS headers in its JSON response. 

Modify your `lambda1.py` file to include these headers in the returned dictionary:

```python
return {
    'statusCode': 200,
    'headers': {
        'Access-Control-Allow-Origin': '*', # Adjust this to your custom domain for security
        'Access-Control-Allow-Headers': 'Content-Type,X-Api-Key',
        'Access-Control-Allow-Methods': 'OPTIONS,POST'
    },
    'body': json.dumps({
        'message': 'URL Created',
        'short_id': short_id,
        'original_url': long_url
    })
}
```

---

## Uploading Frontend Files to S3

Once your S3 bucket is provisioned (via CloudFormation or manually), copy your static files to it.

### Option A: Via AWS CLI (Fastest)
Run the following command from the root of this project:
```bash
aws s3 sync frontend/ s3://<your-s3-bucket-name> --exclude "frontend-deploy.yaml" --exclude "DEPLOYMENT.md"
```

### Option B: Via AWS Console
1. Go to **S3** -> Click on your bucket name.
2. Click **Upload** -> Select `index.html`, `style.css`, and `app.js` (do not upload `frontend-deploy.yaml` or `DEPLOYMENT.md` to the S3 bucket).
3. Click **Upload**.
