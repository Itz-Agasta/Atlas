variable "aws_region" {
  description = "AWS region to deploy to"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Project name (used for resource naming)"
  type        = string
  default     = "atlas-workers"
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# Environment variables for Lambda
variable "pg_write_url" {
  description = "PostgreSQL connection URL"
  type        = string
  sensitive   = true
}

variable "s3_access_key" {
  description = "Cloudflare R2 access key"
  type        = string
  sensitive   = true
}

variable "s3_secret_key" {
  description = "Cloudflare R2 secret key"
  type        = string
  sensitive   = true
}

variable "s3_endpoint" {
  description = "Cloudflare R2 endpoint"
  type        = string
}

variable "s3_bucket_name" {
  description = "R2 bucket name"
  type        = string
  default     = "atlas"
}

variable "argo_dac" {
  description = "ARGO Data Assembly Center"
  type        = string
  default     = "incois"
}

variable "schedule_expression" {
  description = "Cron schedule for weekly sync (rate or cron expression)"
  type        = string
  default     = "rate(7 days)" # Every 7 days
}

variable "lambda_timeout" {
  description = "Lambda timeout in seconds (max 900 = 15 min)"
  type        = number
  default     = 900 # 15 minutes
}

variable "lambda_memory" {
  description = "Lambda memory in MB (128-10240)"
  type        = number
  default     = 512
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}