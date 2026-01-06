# Atlas Infrastructure as Code

This directory contains **Terraform configurations** for deploying the Atlas platform to cloud. We use Infrastructure as Code (IaC) to ensure reproducible, version-controlled deployments across environments.

## Architecture Overview

Atlas is a **monorepo** with multiple services:

- API gateway
- Web App
- workers
- ML services
- Dbs

This Terraform module **focuses on the Workers deployment** - the serverless data processing pipeline.

## Deployed Infrastructure

### AWS Lambda Worker

**Purpose:** Scheduled data synchronization and batch processing for oceanographic float data (ARGO).

**Configuration:**

| Component         | Details                  |
| ----------------- | ------------------------ |
| **Function Name** | `atlas-worker`           |
| **Region**        | `ap-south-1`             |
| **Memory**        | 1 GB                     |
| **Timeout**       | 15 minutes               |
| **Package Type**  | Container Image (Docker) |

### ECR Repository

- **Repository:** `atlas-worker` in Amazon ECR
- **Image Source:** Built from `apps/workers/Dockerfile`
- **Registry:** AWS account-specific registry

### EventBridge Scheduler

- **Trigger:** Weekly schedule (`rate(7 days)`)
- **Target:** Lambda function
- **Operation:** Automatic float data updates

## Testing the Deployment

### Single Float Sync (On-Demand)

Test processing a specific ARGO float:

```bash
aws lambda invoke \
  --function-name atlas-worker \
  --cli-binary-format raw-in-base64-out \
  --payload '{"operation": "sync", "float_id": "2902224"}' \
  response.json

cat response.json
```

**Expected Output:** JSON response with sync status and processing metrics.

### Weekly Update (Scheduler Test)

Test the scheduled weekly synchronization:

```bash
aws lambda invoke \
  --function-name atlas-worker \
  --cli-binary-format raw-in-base64-out \
  --payload '{"operation": "update"}' \
  response.json

cat response.json
```
